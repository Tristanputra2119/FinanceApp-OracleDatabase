/**
 * tests/analytics.test.ts – TDD suite for Analytics API
 * Covered: GET /api/analytics/chart, GET /api/analytics/category-breakdown
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

function makeRow(month: string, rn: number, expense: number, income: number,
  expSlope = 50, expInt = 1000, incSlope = 100, incInt = 2000, r2 = 0.92, maxRn = 12) {
  return { MONTH_LABEL: month, RN: rn, EXPENSE: expense, INCOME: income,
    EXP_SLOPE: expSlope, EXP_INTERCEPT: expInt, INC_SLOPE: incSlope,
    INC_INTERCEPT: incInt, R_SQUARED: r2, MAX_RN: maxRn };
}

describe('GET /api/analytics/chart', () => {
  it('TDD-ANA-1: returns shaped months + prediction when DB has rows', async () => {
    const rows = [
      makeRow('2026-01', 1, 3000, 6000), makeRow('2026-02', 2, 3200, 6200),
      makeRow('2026-03', 3, 3100, 6100), makeRow('2026-04', 4, 3400, 6400),
      makeRow('2026-05', 5, 3500, 6500)
    ];
    mockDb.execute.mockResolvedValueOnce({ rows } as any);

    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.months).toHaveLength(5);
    expect(res.body.data.months[0]).toMatchObject({ label: '2026-01', expense: 3000, income: 6000 });
    expect(res.body.data.prediction).toBeDefined();
    expect(res.body.data.prediction.next_months).toHaveLength(3);
    expect(res.body.data.prediction.confidence).toBe(92);
  });

  it('TDD-ANA-2: trend is "increasing" when exp_slope > 50', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [makeRow('2026-05', 5, 5000, 7000, 200)] } as any);
    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    expect(res.body.data.prediction.trend).toBe('increasing');
  });

  it('TDD-ANA-3: trend is "decreasing" when exp_slope < -50', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [makeRow('2026-05', 5, 5000, 7000, -100)] } as any);
    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    expect(res.body.data.prediction.trend).toBe('decreasing');
  });

  it('TDD-ANA-4: trend is "stable" when exp_slope is between -50 and 50', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [makeRow('2026-05', 5, 5000, 7000, 10)] } as any);
    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    expect(res.body.data.prediction.trend).toBe('stable');
  });

  it('TDD-ANA-5: returns empty data shape when DB has no rows', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.months).toHaveLength(0);
    expect(res.body.data.prediction).toBeNull();
  });

  it('TDD-ANA-6: predicted values are never negative', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [makeRow('2026-05', 5, 1000, 2000, -5000, 0, -5000, 0)] } as any);
    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    const nm: any[] = res.body.data.prediction.next_months;
    nm.forEach(m => {
      expect(m.predicted_expense).toBeGreaterThanOrEqual(0);
      expect(m.predicted_income).toBeGreaterThanOrEqual(0);
    });
  });

  it('TDD-ANA-7: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ORA-04031'));
    const res = await request(app).get('/api/analytics/chart').set(authHeaders);
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/analytics/breakdown', () => {
  it('TDD-ANA-CB-1: returns category data array', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ CATEGORY: 'Food', TOTAL: 2500 }, { CATEGORY: 'Utils', TOTAL: 900 }]
    } as any);
    const res = await request(app).get('/api/analytics/breakdown').set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('TDD-ANA-CB-2: returns empty array when no data', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(app).get('/api/analytics/breakdown').set(authHeaders);
    expect(res.body.data).toEqual([]);
  });

  it('TDD-ANA-CB-3: returns 500 on DB error', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('timeout'));
    const res = await request(app).get('/api/analytics/breakdown').set(authHeaders);
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('TDD-ANA-CB-4: returns 401 without token', async () => {
    const res = await request(app).get('/api/analytics/breakdown').set({ 'X-App-Request': '1' });
    expect(res.statusCode).toBe(401);
  });
});
