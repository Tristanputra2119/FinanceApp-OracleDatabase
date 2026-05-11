import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import db from './db';

interface OracleError extends Error {
  errorNum?: number;
}

async function migrateAuth(): Promise<void> {
  let connection: oracledb.Connection | undefined;
  try {
    console.log('Connecting to database...');
    await db.getPool();
    connection = await db.getConnection();

    const sqlFile = fs.readFileSync(
      path.join(__dirname, 'database', 'auth_schema.sql'),
      'utf8'
    );
    const stmt = sqlFile.replace(/--.*$/gm, '').trim().replace(/;$/, '');

    if (stmt) {
      await connection.execute(stmt);
      console.log('Users table created successfully!');
    }

  } catch (err) {
    const oraErr = err as OracleError;
    if (oraErr.errorNum === 955) {
      console.log('Users table already exists.');
    } else {
      console.error('Migration error:', err);
    }
  } finally {
    if (connection) await connection.close();
    process.exit(0);
  }
}

migrateAuth();
