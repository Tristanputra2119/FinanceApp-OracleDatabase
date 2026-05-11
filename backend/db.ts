import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

// Oracle Cloud ATP Config - using Thin mode natively
// TNS_ADMIN environment variable will automatically point to the wallet.

interface DbConfig {
  user: string;
  password: string;
  connectString: string;
}

const dbConfig: DbConfig = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  connectString:
    '(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.ap-batam-1.oraclecloud.com))(connect_data=(service_name=gf2e146b4ef02f6_belajar_tp.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))'
};

async function getPool(): Promise<oracledb.Pool> {
  try {
    const pool = await oracledb.createPool({
      ...dbConfig,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1
    });
    console.log('Oracle Database connection pool created successfully');
    return pool;
  } catch (err) {
    console.error('Error creating database pool: ', err);
    throw err;
  }
}

async function getConnection(): Promise<oracledb.Connection> {
  return oracledb.getConnection();
}

// Fetch helper to format results as objects instead of arrays
async function execute(
  sql: string,
  binds: oracledb.BindParameters = [],
  options: oracledb.ExecuteOptions = {}
): Promise<oracledb.Result<Record<string, unknown>>> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();
    const result = await connection.execute<Record<string, unknown>>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options
    });
    return result;
  } catch (err) {
    console.error('Database query execution error: ', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection: ', err);
      }
    }
  }
}

export default {
  getPool,
  getConnection,
  execute
};
