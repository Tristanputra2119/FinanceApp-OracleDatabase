/**
 * seed.ts — realistic trending data for Oracle REGR_* analytics
 *
 * Strategy for good R²:
 * - 24 months of data (more points = better regression)
 * - Monthly expense grows ~4% per month (simulates lifestyle creep)
 * - Income is stable ~$4500/month (realistic: salary doesn't grow as fast)
 * - Multiple transactions per month, amounts distributed around monthly target
 * - Clear upward trend in expenses → REGR_R2 should be ~0.85–0.95
 */

import oracledb from 'oracledb';
import db from './db';

interface OracleError extends Error { errorNum?: number; }

// ─── Config ───────────────────────────────────────────────────────────────────
const MONTHS_BACK        = 24;   // data spanning last 24 months
const BASE_EXPENSE_PM    = 1200; // starting monthly expense (month 1)
const GROWTH_RATE        = 0.04; // 4% growth per month
const BASE_INCOME_PM     = 4500; // relatively stable monthly income
const INCOME_VARIANCE    = 0.05; // ±5% income variation
const TX_PER_MONTH_MIN   = 8;    // minimum transactions per month
const TX_PER_MONTH_MAX   = 15;   // maximum transactions per month
const CLEAR_EXISTING     = true; // delete existing transaction data before seeding

// Expense categories and how much of total they take
const EXPENSE_ACCOUNTS: { accNo: string; weight: number; tags: string[] }[] = [
  { accNo: '5001', weight: 0.25, tags: ['Lunch', 'Dinner', 'Groceries', 'Coffee', 'Snacks', 'Meal prep'] },
  { accNo: '5002', weight: 0.15, tags: ['Grab', 'Fuel', 'Parking', 'Toll', 'Bus pass', 'Ojek'] },
  { accNo: '5003', weight: 0.35, tags: ['Rent payment', 'Kos monthly', 'House rent', 'Room rent'] },
  { accNo: '5004', weight: 0.10, tags: ['Electricity', 'Water bill', 'Internet', 'Phone bill', 'Gas'] },
  { accNo: '5005', weight: 0.05, tags: ['Doctor visit', 'Medicine', 'Vitamins', 'Checkup'] },
  { accNo: '5006', weight: 0.10, tags: ['Netflix', 'Spotify', 'Cinema', 'Game', 'Shopping', 'Gym'] },
];

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a Date object for a given month offset from now (negative = past)
function monthDate(offsetFromNow: number, dayOfMonth: number): Date {
  const d = new Date();
  d.setDate(dayOfMonth);
  d.setMonth(d.getMonth() + offsetFromNow);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function seedDatabase(): Promise<void> {
  let connection: oracledb.Connection | undefined;
  try {
    await db.getPool();
    connection = await db.getConnection();
    console.log('✅ Connected to Oracle ATP\n');

    // ── Step 1: Read existing account IDs ─────────────────────────────────
    console.log('📌 Loading account IDs...');
    const accResult = await connection.execute(
      `SELECT account_number, account_id FROM Accounts
       WHERE account_number IN ('1000','4000','5001','5002','5003','5004','5005','5006')`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const accountMap: Record<string, number> = {};
    for (const row of (accResult.rows ?? []) as Array<{ ACCOUNT_NUMBER: string; ACCOUNT_ID: number }>) {
      accountMap[row.ACCOUNT_NUMBER] = row.ACCOUNT_ID;
    }

    // If accounts don't exist, insert them
    if (!accountMap['1000']) {
      console.log('   Creating accounts...');
      const accountsData = [
        { accNo: '1000', name: 'Main Bank Account', type_id: 1 },
        { accNo: '4000', name: 'Salary Income',     type_id: 4 },
        { accNo: '5001', name: 'Food Expense',       type_id: 5 },
        { accNo: '5002', name: 'Transport Expense',  type_id: 5 },
        { accNo: '5003', name: 'Rent Expense',       type_id: 5 },
        { accNo: '5004', name: 'Utilities Expense',  type_id: 5 },
        { accNo: '5005', name: 'Healthcare',         type_id: 5 },
        { accNo: '5006', name: 'Entertainment',      type_id: 5 },
      ];
      for (const acc of accountsData) {
        try {
          await connection.execute(
            `INSERT INTO Accounts (account_number, name, type_id, currency_code) VALUES (:1,:2,:3,'USD')`,
            [acc.accNo, acc.name, acc.type_id]
          );
        } catch (e) {
          const oe = e as OracleError;
          if (oe.errorNum !== 1) console.error('Account insert error:', (e as Error).message);
        }
      }
      await connection.commit();

      // Re-read
      const r2 = await connection.execute(
        `SELECT account_number, account_id FROM Accounts WHERE account_number IN ('1000','4000','5001','5002','5003','5004','5005','5006')`,
        [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      for (const row of (r2.rows ?? []) as Array<{ ACCOUNT_NUMBER: string; ACCOUNT_ID: number }>) {
        accountMap[row.ACCOUNT_NUMBER] = row.ACCOUNT_ID;
      }
    }

    const bankId    = accountMap['1000'];
    const incomeId  = accountMap['4000'];
    console.log(`   bank=${bankId}, income=${incomeId}`);
    console.log(`   expenses: ${EXPENSE_ACCOUNTS.map(e => `${e.accNo}=${accountMap[e.accNo]}`).join(', ')}\n`);

    // ── Step 2: Optionally clear existing transactions ─────────────────────
    if (CLEAR_EXISTING) {
      console.log('🗑️  Clearing existing transaction data...');
      // TransactionLines cascades on delete, so just delete Transactions
      await connection.execute('DELETE FROM Transactions', [], { autoCommit: true });
      console.log('   Done.\n');
    }

    // ── Step 3: Generate 24 months of trending data ────────────────────────
    console.log(`🚀 Generating ${MONTHS_BACK} months of trending data...`);
    console.log(`   Base expense: $${BASE_EXPENSE_PM}/mo → grows ${(GROWTH_RATE * 100).toFixed(0)}%/mo`);
    console.log(`   Income: ~$${BASE_INCOME_PM}/mo (stable)\n`);

    let totalInserted = 0;
    const startTime = Date.now();

    for (let monthOffset = -MONTHS_BACK + 1; monthOffset <= 0; monthOffset++) {
      // Month index from 1 (oldest) to MONTHS_BACK (current)
      const monthIndex = monthOffset + MONTHS_BACK; // 1..24

      // Target expense for this month: grows each month
      const targetExpense = BASE_EXPENSE_PM * Math.pow(1 + GROWTH_RATE, monthIndex - 1);

      // Target income: stable with small variance
      const targetIncome = BASE_INCOME_PM * (1 + randBetween(-INCOME_VARIANCE, INCOME_VARIANCE));

      const txCount = Math.floor(randBetween(TX_PER_MONTH_MIN, TX_PER_MONTH_MAX));
      let expenseLeft = targetExpense;

      // ── Income transaction (1 per month, around payday ~25th) ──────────
      const incomeDate = monthDate(monthOffset, 25);
      const incomeRef  = `SAL-${incomeDate.getFullYear()}-${String(incomeDate.getMonth() + 1).padStart(2, '0')}`;
      const incomeAmt  = roundTo2(targetIncome);

      await insertTransaction(
        connection,
        incomeDate,
        `Monthly salary - ${incomeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        incomeRef,
        bankId,    // debit: asset (bank gains money)
        incomeId   // credit: revenue
      , incomeAmt);
      totalInserted++;

      // ── Expense transactions ────────────────────────────────────────────
      for (let i = 0; i < txCount; i++) {
        const isLastTx = (i === txCount - 1);

        // Pick a category weighted by its proportion
        const cat = pickWeighted(EXPENSE_ACCOUNTS);
        const catAccId = accountMap[cat.accNo];

        // For last tx, use remaining amount; otherwise, proportional amount with variance
        let amount: number;
        if (isLastTx) {
          amount = Math.max(5, roundTo2(expenseLeft));
        } else {
          const base = targetExpense * cat.weight;
          const variance = randBetween(0.6, 1.4);
          amount = roundTo2(Math.min(expenseLeft * 0.8, base * variance));
        }
        expenseLeft -= amount;
        if (amount <= 0) amount = roundTo2(randBetween(5, 50));

        const day     = Math.floor(randBetween(1, 28));
        const txDate  = monthDate(monthOffset, day);
        const desc    = pickRandom(cat.tags);
        const ref     = `EXP-${txDate.getFullYear()}${String(txDate.getMonth()+1).padStart(2,'0')}${String(day).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;

        await insertTransaction(
          connection,
          txDate,
          desc,
          ref,
          catAccId, // debit: expense account
          bankId,   // credit: bank (money leaves bank)
          amount
        );
        totalInserted++;
      }

      // Commit every month
      await connection.commit();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const monthLabel = monthDate(monthOffset, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      console.log(`   ✓ ${monthLabel.padEnd(12)} | target_exp=$${targetExpense.toFixed(0).padStart(6)} | income=$${incomeAmt.toFixed(0).padStart(6)} | ${txCount+1} tx | ${elapsed}s`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Done! Inserted ${totalInserted} transactions in ${duration}s`);
    console.log('\n📈 Expected R² after this seed: ~0.80–0.95 (linear upward trend in expenses)');

  } catch (err) {
    console.error('❌ Seeder failed:', err);
  } finally {
    if (connection) await connection.close();
    process.exit(0);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function insertTransaction(
  conn: oracledb.Connection,
  txDate: Date,
  description: string,
  refNo: string,
  debitAccId: number,
  creditAccId: number,
  amount: number
): Promise<void> {
  const tResult = await conn.execute(
    `INSERT INTO Transactions (transaction_date, description, reference_number, status)
     VALUES (:1, :2, :3, 'POSTED') RETURNING transaction_id INTO :4`,
    [txDate, description, refNo, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
  );
  const txId = ((tResult.outBinds as number[][])[0][0]);

  await conn.execute(
    `INSERT INTO TransactionLines (transaction_id, account_id, currency_code, debit_amount, credit_amount, description)
     VALUES (:1, :2, 'USD', :3, 0, :4)`,
    [txId, debitAccId, amount, description]
  );
  await conn.execute(
    `INSERT INTO TransactionLines (transaction_id, account_id, currency_code, debit_amount, credit_amount, description)
     VALUES (:1, :2, 'USD', 0, :3, :4)`,
    [txId, creditAccId, amount, description]
  );
}

function pickWeighted(items: { accNo: string; weight: number; tags: string[] }[]) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

seedDatabase();
