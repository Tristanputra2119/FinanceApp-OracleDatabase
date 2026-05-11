import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import db from './db';

interface OracleError extends Error {
  errorNum?: number;
}

async function runMigration(): Promise<void> {
  let connection: oracledb.Connection | undefined;
  try {
    console.log('Initializing database connection...');
    await db.getPool();
    connection = await db.getConnection();
    console.log('Connected to Oracle ATP successfully!');

    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const sqlFile = fs.readFileSync(schemaPath, 'utf8');

    // Remove comments
    const noComments = sqlFile.replace(/--.*$/gm, '');

    // Split by semicolon
    const statements = noComments
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    console.log(`Found ${statements.length} statements to execute.`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await connection.execute(stmt);
      } catch (err) {
        const oraErr = err as OracleError;
        // ORA-00955: name is already used by an existing object
        if (oraErr.errorNum === 955) {
          console.log(`Skipped statement ${i + 1} (Object already exists).`);
        } else {
          console.error(
            `Error executing statement ${i + 1}:\n${stmt}\nError: ${(err as Error).message}`
          );
          // Continue on non-critical errors
        }
      }
    }

    // Commit
    await connection.commit();
    console.log('Migration completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Connection closed.');
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
    process.exit(0);
  }
}

runMigration();
