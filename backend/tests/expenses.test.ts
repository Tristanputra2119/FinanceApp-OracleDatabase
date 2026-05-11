/**
 * tests/expenses.test.ts – TDD suite for Expenses/Transactions API
 * Covered:
 *   GET    /api/expenses             (list transactions)
 *   GET    /api/expenses/monthly     (monthly aggregates)
 *   GET    /api/expenses/accounts    (chart-of-accounts)
 *   GET    /api/expenses/:id         (single transaction)
 *   POST   /api/expenses             (create)
 *   PUT    /api/expenses/:id         (update)
 *   DELETE /api/expenses/:id         (delete)
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import db from '../db';

jest.mock('../db', () => ({
  execute: jest.fn(),
  getPool: jest.fn().mockResolvedValue({}),
  getConnection: jest.fn()
}));

const mockDb = db as jest.Mocked<typeof db>;
const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(userId = 1, role = 'user') {
  return jwt.sign({ user: { id: userId, role } }, JWT_SECRET, { expiresIn: '1h' });
}

const authHeaders = {
  'X-App-Request': '1',
  Authorization: `Bearer ${makeToken()}`
};

const sampleTxRow = {
  TRANSACTION_ID:   1,
  TRANSACTION_DATE: '2026-05-01',
  DESCRIPTION:      'Test expense',
  REFERENCE_NUMBER: 'REF-100',
  STATUS:           'POSTED',
  DEBIT_ACCOUNT:    'Office Expense',
  DEBIT_ACCOUNT_ID:  5,
  CREDIT_ACCOUNT:   'Cash',
  CREDIT_ACCOUNT_ID: 1,
  AMOUNT:           500,
  TYPE:             'expense'
};

// ── GET /api/expenses ─────────────────────────────────────────────────────────

describe('GET /api/expenses', () => {
  it('TDD-EXP-LIST-1: returns list of transactions', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [sampleTxRow] } as any);
    const res = await request(app).get('/api/expenses').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].TRANSACTION_ID).toBe(1);
  });

  it('TDD-EXP-LIST-2: returns empty array when no transactions', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(app).get('/api/expenses').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('TDD-EXP-LIST-3: returns 500 on DB failure', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/expenses').set(authHeaders);
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('TDD-EXP-LIST-4: returns 401 without auth token', async () => {
    const res = await request(app).get('/api/expenses').set({ 'X-App-Request': '1' });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/expenses/monthly ─────────────────────────────────────────────────

describe('GET /api/expenses/monthly', () => {
  it('TDD-EXP-MON-1: returns real data when DB succeeds', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { MONTH: '2026-05', TOTAL_EXPENSE: 1500 },
        { MONTH: '2026-04', TOTAL_EXPENSE: 1200 }
      ]
    } as any);
    const res = await request(app).get('/api/expenses/monthly').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mocked).toBeUndefined();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].TOTAL_EXPENSE).toBe(1500);
  });

  it('TDD-EXP-MON-2: returns mocked fallback when DB fails', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Database not reachable'));
    const res = await request(app).get('/api/expenses/monthly').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mocked).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('MONTH');
  });
});

// ── GET /api/expenses/accounts ────────────────────────────────────────────────

describe('GET /api/expenses/accounts', () => {
  it('TDD-EXP-ACC-1: returns accounts list', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { ACCOUNT_ID: 1, ACCOUNT_NUMBER: '1001', NAME: 'Cash', TYPE_ID: 1, TYPE_NAME: 'Asset' }
      ]
    } as any);
    const res = await request(app).get('/api/expenses/accounts').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].NAME).toBe('Cash');
  });

  it('TDD-EXP-ACC-2: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ORA-01017'));
    const res = await request(app).get('/api/expenses/accounts').set(authHeaders);
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/expenses/:id ─────────────────────────────────────────────────────

describe('GET /api/expenses/:id', () => {
  it('TDD-EXP-GET-1: returns a single transaction by ID', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [sampleTxRow] } as any);
    const res = await request(app).get('/api/expenses/1').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('TDD-EXP-GET-2: returns 404 when transaction does not exist', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(app).get('/api/expenses/9999').set(authHeaders);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('TDD-EXP-GET-3: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Query timeout'));
    const res = await request(app).get('/api/expenses/1').set(authHeaders);
    expect(res.statusCode).toBe(500);
  });
});

// ── POST /api/expenses ────────────────────────────────────────────────────────

describe('POST /api/expenses', () => {
  const validPayload = {
    description:      'Office Supplies',
    amount:           300,
    transaction_date: '2026-05-10',
    debit_account_id:  5,
    credit_account_id: 1,
    reference_number: 'REF-201'
  };

  it('TDD-EXP-POST-1: creates a transaction and returns 201', async () => {
    mockDb.execute
      .mockResolvedValueOnce({ outBinds: [[99]], rowsAffected: 1 } as any) // INSERT tx header
      .mockResolvedValueOnce({ rowsAffected: 1 }                  as any)  // INSERT debit line
      .mockResolvedValueOnce({ rowsAffected: 1 }                  as any); // INSERT credit line

    const res = await request(app).post('/api/expenses').set(authHeaders).send(validPayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.transactionId).toBe(99);
  });

  it('TDD-EXP-POST-2: returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set(authHeaders)
      .send({ description: 'Incomplete' }); // missing amount, date, accounts
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing required/i);
  });

  it('TDD-EXP-POST-3: returns 400 when amount <= 0', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set(authHeaders)
      .send({ ...validPayload, amount: -50 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/greater than 0/i);
  });

  it('TDD-EXP-POST-4: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ORA-01400: cannot insert null'));
    const res = await request(app).post('/api/expenses').set(authHeaders).send(validPayload);
    expect(res.statusCode).toBe(500);
  });
});

// ── PUT /api/expenses/:id ─────────────────────────────────────────────────────

describe('PUT /api/expenses/:id', () => {
  it('TDD-EXP-PUT-1: updates a transaction and returns 200', async () => {
    mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 } as any);
    const res = await request(app)
      .put('/api/expenses/1')
      .set(authHeaders)
      .send({ description: 'Updated description' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/updated/i);
  });

  it('TDD-EXP-PUT-2: returns 404 when transaction not found', async () => {
    mockDb.execute.mockResolvedValueOnce({ rowsAffected: 0 } as any);
    const res = await request(app)
      .put('/api/expenses/9999')
      .set(authHeaders)
      .send({ description: 'Ghost' });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('TDD-EXP-PUT-3: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ORA-00942: table does not exist'));
    const res = await request(app)
      .put('/api/expenses/1')
      .set(authHeaders)
      .send({ description: 'Crash test' });
    expect(res.statusCode).toBe(500);
  });
});

// ── DELETE /api/expenses/:id ──────────────────────────────────────────────────

describe('DELETE /api/expenses/:id', () => {
  it('TDD-EXP-DEL-1: deletes a transaction and returns 200', async () => {
    mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 } as any);
    const res = await request(app).delete('/api/expenses/1').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('TDD-EXP-DEL-2: returns 404 when transaction does not exist', async () => {
    mockDb.execute.mockResolvedValueOnce({ rowsAffected: 0 } as any);
    const res = await request(app).delete('/api/expenses/9999').set(authHeaders);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('TDD-EXP-DEL-3: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Lock timeout'));
    const res = await request(app).delete('/api/expenses/1').set(authHeaders);
    expect(res.statusCode).toBe(500);
  });
});
