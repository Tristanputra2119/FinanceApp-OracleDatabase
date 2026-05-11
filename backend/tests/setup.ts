/**
 * tests/setup.ts
 *
 * Runs BEFORE every test file.
 * Sets env variables so server.ts / db.ts can import without crashing
 * (they read these at module evaluation time via dotenv).
 */

process.env.NODE_ENV    = 'test';
process.env.JWT_SECRET  = 'test_secret_key_for_jest';
process.env.DB_USER     = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.PORT        = '5001';
process.env.FRONTEND_URL = 'http://localhost:5173';
