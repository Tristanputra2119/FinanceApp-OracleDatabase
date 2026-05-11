/**
 * tests/dashboard.test.ts
 *
 * TDD suite for Dashboard Summary API
 *
 * Strategy
 * --------
 * - Mock `../db` so we never touch Oracle.
 * - Generate a valid JWT to pass the auth middleware.
 * - Sequence db.execute mock returns to match controller's 4 sequential queries:
 *     1. assetSql   → BALANCE
 *     2. expenseSql → TOTAL_EXPENSE
 *     3. incomeSql  → TOTAL_INCOME
 *     4. recentSql  → TxRow[]
 *
 * Covered endpoints
 * -----------------
 *   GET /api/dashboard/summary
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import db from '../db';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => ({
  execute:       jest.fn(),
  getPool:       jest.fn().mockResolvedValue({}),
  getConnection: jest.fn()
}));

const mockDb = db as jest.Mocked<typeof db>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(userId = 1, role = 'user'): string {
  return jwt.sign({ user: { id: userId, role } }, JWT_SECRET, { expiresIn: '1h' });
}

const baseHeaders = {
  'X-App-Request': '1',
  Authorization: `Bearer ${makeToken()}`
};

// Fixture for 4 sequential db.execute calls
function mockSummaryResponses(
  balance = 50000,
  expense = 1500,
  income  = 3000,
  txRows  = [] as Record<string, unknown>[]
) {
  mockDb.execute
    .mockResolvedValueOnce({ rows: [{ BALANCE: balance }] }        as any) // assetSql
    .mockResolvedValueOnce({ rows: [{ TOTAL_EXPENSE: expense }] }  as any) // expenseSql
    .mockResolvedValueOnce({ rows: [{ TOTAL_INCOME: income }] }    as any) // incomeSql
    .mockResolvedValueOnce({ rows: txRows }                        as any); // recentSql
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/dashboard/summary', () => {

  it('TDD-DASH-1: should return summary with correct fields when DB succeeds', async () => {
    const txRow = {
      TRANSACTION_ID:   101,
      TRANSACTION_DATE: new Date('2026-05-01').toISOString(),
      AMOUNT:           2000,
      DESCRIPTION:      'Salary',
      REFERENCE_NUMBER: 'REF-001',
      DEBIT_ACCOUNT:    'Cash',
      CREDIT_ACCOUNT:   'Revenue',
      DEBIT_TYPE_ID:    1,
      CREDIT_TYPE_ID:   4
    };
    mockSummaryResponses(50000, 1500, 3000, [txRow]);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(baseHeaders);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('currentBalance', 50000);
    expect(data).toHaveProperty('monthlyExpense', 1500);
    expect(data).toHaveProperty('monthlyIncome',  3000);
    expect(Array.isArray(data.recentTransactions)).toBe(true);
    expect(data.recentTransactions).toHaveLength(1);
  });

  it('TDD-DASH-2: should classify income transaction type correctly', async () => {
    const incomeRow = {
      TRANSACTION_ID:   200,
      TRANSACTION_DATE: new Date('2026-05-02').toISOString(),
      AMOUNT:           5000,
      DESCRIPTION:      'Consulting',
      REFERENCE_NUMBER: 'REF-002',
      DEBIT_ACCOUNT:    'Cash',
      CREDIT_ACCOUNT:   'Revenue',
      DEBIT_TYPE_ID:    1,  // Asset
      CREDIT_TYPE_ID:   4   // Revenue → income
    };
    mockSummaryResponses(50000, 0, 5000, [incomeRow]);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(baseHeaders);

    const tx = res.body.data.recentTransactions[0];
    expect(tx.type).toBe('income');
    expect(tx.category).toBe('Revenue'); // credit_account for income
  });

  it('TDD-DASH-3: should classify expense transaction type correctly', async () => {
    const expenseRow = {
      TRANSACTION_ID:   300,
      TRANSACTION_DATE: new Date('2026-05-03').toISOString(),
      AMOUNT:           800,
      DESCRIPTION:      'Office supplies',
      REFERENCE_NUMBER: 'REF-003',
      DEBIT_ACCOUNT:    'Office Expense',
      CREDIT_ACCOUNT:   'Cash',
      DEBIT_TYPE_ID:    5,  // Expense
      CREDIT_TYPE_ID:   1   // Asset → expense
    };
    mockSummaryResponses(49200, 800, 0, [expenseRow]);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(baseHeaders);

    const tx = res.body.data.recentTransactions[0];
    expect(tx.type).toBe('expense');
    expect(tx.category).toBe('Office Expense'); // debit_account for expense
  });

  it('TDD-DASH-4: should return zeros when DB returns null/undefined values', async () => {
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ BALANCE: null }] }         as any)
      .mockResolvedValueOnce({ rows: [{ TOTAL_EXPENSE: null }] }   as any)
      .mockResolvedValueOnce({ rows: [{ TOTAL_INCOME: null }] }    as any)
      .mockResolvedValueOnce({ rows: [] }                          as any);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(baseHeaders);

    expect(res.statusCode).toBe(200);
    const { data } = res.body;
    expect(data.currentBalance).toBe(0);
    expect(data.monthlyExpense).toBe(0);
    expect(data.monthlyIncome).toBe(0);
  });

  it('TDD-DASH-5: should return 500 when DB query throws', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ORA-12541: no listener'));

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(baseHeaders);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/server error/i);
  });

  it('TDD-DASH-6: should return 401 when no auth token is provided', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set({ 'X-App-Request': '1' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('TDD-DASH-7: should return 401 when an invalid JWT is provided', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set({ 'X-App-Request': '1', Authorization: 'Bearer invalid.token.here' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
