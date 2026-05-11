/**
 * tests/auth.test.ts
 *
 * TDD suite for Authentication API
 *
 * Strategy
 * --------
 * - Mock `../db` so we never touch Oracle.
 * - Mock `bcryptjs` to avoid slow hashing in tests.
 * - Verify HTTP status codes, response shapes, and guard conditions.
 *
 * Covered endpoints
 * -----------------
 *   POST /api/auth/register
 *   POST /api/auth/login
 */

import request from 'supertest';
import app from '../server';
import db from '../db';
import bcrypt from 'bcryptjs';

// Note: api.ts now tags 4xx responses with isClientError=true so callers
// can distinguish expected business rejections (wrong password, 404, etc.)
// from real server/network errors — no console.error for those paths.

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../db', () => ({
  execute:       jest.fn(),
  getPool:       jest.fn().mockResolvedValue({}),
  getConnection: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  genSalt:  jest.fn().mockResolvedValue('salt'),
  hash:     jest.fn().mockResolvedValue('hashed_password'),
  compare:  jest.fn()
}));

const mockDb     = db       as jest.Mocked<typeof db>;
const mockBcrypt = bcrypt   as jest.Mocked<typeof bcrypt>;

// Helper: shared headers that bypass the X-App-Request guard
const appHeaders = { 'X-App-Request': '1' };

// ── Register ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {

  it('TDD-AUTH-R1: should register a new user successfully (201)', async () => {
    // First call: email check → no rows
    mockDb.execute
      .mockResolvedValueOnce({ rows: [] } as any)
      // Second call: INSERT RETURNING
      .mockResolvedValueOnce({ outBinds: [[42]] } as any);

    const res = await request(app)
      .post('/api/auth/register')
      .set(appHeaders)
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.userId).toBe(42);
    expect(res.body.message).toMatch(/registered/i);
  });

  it('TDD-AUTH-R2: should reject registration when email is already taken (400)', async () => {
    // Email check returns an existing user
    mockDb.execute.mockResolvedValueOnce({ rows: [{ USER_ID: 1 }] } as any);

    const res = await request(app)
      .post('/api/auth/register')
      .set(appHeaders)
      .send({ name: 'Bob', email: 'existing@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('TDD-AUTH-R3: should return 500 when DB throws on register', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ORA-00001: unique constraint violated'));

    const res = await request(app)
      .post('/api/auth/register')
      .set(appHeaders)
      .send({ name: 'Charlie', email: 'charlie@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {

  it('TDD-AUTH-L1: should login successfully and return JWT (200)', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ USER_ID: 1, NAME: 'Alice', PASSWORD_HASH: 'hashed_password', ROLE: 'user' }]
    } as any);
    (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .set(appHeaders)
      .send({ email: 'alice@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.id).toBe(1);
    expect(res.body.user.name).toBe('Alice');
    // password hash must NOT leak to the client
    expect(res.body.user.PASSWORD_HASH).toBeUndefined();
  });

  it('TDD-AUTH-L2: should return 401 when email does not exist', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/auth/login')
      .set(appHeaders)
      .send({ email: 'nobody@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('TDD-AUTH-L3: should return 401 when password is wrong', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ USER_ID: 1, NAME: 'Alice', PASSWORD_HASH: 'hashed_password', ROLE: 'user' }]
    } as any);
    (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/auth/login')
      .set(appHeaders)
      .send({ email: 'alice@example.com', password: 'WrongPassword!' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('TDD-AUTH-L4: should return 500 on DB error during login', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Connection timeout'));

    const res = await request(app)
      .post('/api/auth/login')
      .set(appHeaders)
      .send({ email: 'alice@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── Middleware guard ──────────────────────────────────────────────────────────

describe('X-App-Request guard on /api/auth', () => {

  it('TDD-AUTH-G1: should reject requests missing the X-App-Request header (403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'Password1!' });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/forbidden/i);
  });
});
