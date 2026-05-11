import { faker } from '@faker-js/faker';
import oracledb from 'oracledb';
import db from './db';

interface OracleError extends Error { errorNum?: number; }

const TARGET_TRANSACTIONS = 500; // 500 transaksi dummy

async function seedDatabase(): Promise<void> {
  let connection: oracledb.Connection | undefined;
  try {
    await db.getPool();
    connection = await db.getConnection();
    console.log('✅ Seeder: Connected to Oracle ATP');

    // ── 1. Currencies (ignore if exists) ──────────────────────────────────
    console.log('\n📌 Seeding Currencies...');
    const currencies = [
      { code: 'USD', name: 'US Dollar',         symbol: '$'  },
      { code: 'IDR', name: 'Indonesian Rupiah',  symbol: 'Rp' },
      { code: 'EUR', name: 'Euro',               symbol: '€'  },
    ];
    for (const cur of currencies) {
      try {
        await connection.execute(
          `INSERT INTO Currencies (currency_code, name, symbol) VALUES (:1, :2, :3)`,
          [cur.code, cur.name, cur.symbol]
        );
      } catch (e) {
        const oe = e as OracleError;
        if (oe.errorNum !== 1) console.error('Currency error:', (e as Error).message);
      }
    }
    await connection.commit();

    // ── 2. Categories (ignore if exists) ──────────────────────────────────
    console.log('📌 Seeding Categories...');
    const categoryNames = ['Salary', 'Food & Dining', 'Transportation', 'Housing', 'Utilities', 'Healthcare', 'Entertainment'];
    for (const cat of categoryNames) {
      try {
        await connection.execute(`INSERT INTO Categories (name) VALUES (:1)`, [cat]);
      } catch (e) {
        const oe = e as OracleError;
        if (oe.errorNum !== 1) console.error('Category error:', (e as Error).message);
      }
    }
    await connection.commit();

    // ── 3. Accounts (ignore if exists, then READ existing IDs) ────────────
    console.log('📌 Seeding Accounts...');
    const accountsData = [
      { accNo: '1000', name: 'Main Bank Account', type_id: 1, code: 'USD' },
      { accNo: '4000', name: 'Salary Income',     type_id: 4, code: 'USD' },
      { accNo: '5001', name: 'Food Expense',       type_id: 5, code: 'USD' },
      { accNo: '5002', name: 'Transport Expense',  type_id: 5, code: 'USD' },
      { accNo: '5003', name: 'Rent Expense',       type_id: 5, code: 'USD' },
      { accNo: '5004', name: 'Utilities Expense',  type_id: 5, code: 'USD' },
      { accNo: '5005', name: 'Healthcare',         type_id: 5, code: 'USD' },
      { accNo: '5006', name: 'Entertainment',      type_id: 5, code: 'USD' },
    ];

    for (const acc of accountsData) {
      try {
        await connection.execute(
          `INSERT INTO Accounts (account_number, name, type_id, currency_code)
           VALUES (:1, :2, :3, :4)`,
          [acc.accNo, acc.name, acc.type_id, acc.code]
        );
      } catch (e) {
        const oe = e as OracleError;
        if (oe.errorNum !== 1) console.error('Account insert error:', (e as Error).message);
      }
    }
    await connection.commit();

    // Read back account IDs from DB (works whether just inserted or pre-existing)
    const accResult = await connection.execute(
      `SELECT account_number, account_id FROM Accounts WHERE account_number IN ('1000','4000','5001','5002','5003','5004','5005','5006')`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const accountMap: Record<string, number> = {};
    for (const row of (accResult.rows ?? []) as Array<{ ACCOUNT_NUMBER: string; ACCOUNT_ID: number }>) {
      accountMap[row.ACCOUNT_NUMBER] = row.ACCOUNT_ID;
    }

    const bankAccId    = accountMap['1000'];
    const incomeAccId  = accountMap['4000'];
    const expenseAccIds = ['5001','5002','5003','5004','5005','5006']
      .map(n => accountMap[n])
      .filter(Boolean);

    if (!bankAccId || !incomeAccId || expenseAccIds.length === 0) {
      throw new Error(`Account IDs not found. Map: ${JSON.stringify(accountMap)}`);
    }
    console.log(`   Account IDs loaded: bank=${bankAccId}, income=${incomeAccId}, expenses=[${expenseAccIds.join(',')}]`);

    // ── 4. Transactions ────────────────────────────────────────────────────
    console.log(`\n🚀 Seeding ${TARGET_TRANSACTIONS} transactions...`);
    let inserted = 0;
    const start = Date.now();

    for (let i = 0; i < TARGET_TRANSACTIONS; i++) {
      const isIncome = Math.random() > 0.75; // 25% income, 75% expense
      const amount   = parseFloat(faker.finance.amount({ min: 5, max: 3000, dec: 2 }));
      const txDate   = faker.date.between({ from: '2024-01-01', to: '2026-05-11' });
      const refNo    = faker.string.alphanumeric(8).toUpperCase();

      const debitAccId  = isIncome ? bankAccId   : faker.helpers.arrayElement(expenseAccIds);
      const creditAccId = isIncome ? incomeAccId : bankAccId;
      const desc        = isIncome
        ? `Salary - ${faker.person.jobTitle()}`
        : `${faker.commerce.department()}: ${faker.commerce.product()}`;

      try {
        // Header
        const tResult = await connection.execute(
          `INSERT INTO Transactions (transaction_date, description, reference_number, status)
           VALUES (:1, :2, :3, 'POSTED') RETURNING transaction_id INTO :4`,
          [txDate, desc, refNo, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
        );
        const txId = ((tResult.outBinds as number[][])[0][0]);

        // Debit line
        await connection.execute(
          `INSERT INTO TransactionLines (transaction_id, account_id, currency_code, debit_amount, credit_amount, description)
           VALUES (:1, :2, 'USD', :3, 0, :4)`,
          [txId, debitAccId, amount, desc]
        );

        // Credit line
        await connection.execute(
          `INSERT INTO TransactionLines (transaction_id, account_id, currency_code, debit_amount, credit_amount, description)
           VALUES (:1, :2, 'USD', 0, :3, :4)`,
          [txId, creditAccId, amount, desc]
        );

        inserted++;
        if (inserted % 50 === 0) {
          await connection.commit();
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`   ↳ ${inserted}/${TARGET_TRANSACTIONS} inserted... (${elapsed}s)`);
        }
      } catch (e) {
        console.error(`   ✗ Row ${i + 1} failed: ${(e as Error).message}`);
      }
    }

    await connection.commit();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n🎉 Done! Inserted ${inserted}/${TARGET_TRANSACTIONS} transactions in ${duration}s`);

  } catch (err) {
    console.error('❌ Seeder failed:', err);
  } finally {
    if (connection) await connection.close();
    process.exit(0);
  }
}

seedDatabase();
