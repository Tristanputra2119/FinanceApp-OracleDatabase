import request from 'supertest';
import app from '../server';
import db from '../db';

// Mock the database module
jest.mock('../db', () => ({
  execute: jest.fn(),
  getPool: jest.fn().mockResolvedValue({}),
  getConnection: jest.fn()
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('Expenses API', () => {
  beforeEach(() => {
    mockDb.execute.mockClear();
  });

  it('should return mocked expense data when DB query fails (graceful fallback)', async () => {
    // Force db.execute to throw an error
    mockDb.execute.mockRejectedValue(new Error('Database not reachable'));

    const response = await request(app).get('/api/expenses/monthly');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.mocked).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    // The mocked data has MONTH and TOTAL_EXPENSE
    expect(response.body.data[0]).toHaveProperty('MONTH');
  });

  it('should return real data from DB when successful', async () => {
    // Mock successful execution
    mockDb.execute.mockResolvedValue({
      rows: [
        { MONTH: '2026-05', TOTAL_EXPENSE: 1500 },
        { MONTH: '2026-04', TOTAL_EXPENSE: 1200 }
      ]
    } as any);

    const response = await request(app).get('/api/expenses/monthly');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.mocked).toBeUndefined(); // Should not have 'mocked' flag
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].TOTAL_EXPENSE).toBe(1500);
  });
});
