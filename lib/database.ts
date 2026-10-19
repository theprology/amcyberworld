import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

type DatabaseValue = string | number | boolean | null | Date | Buffer;
type Executor = Pool | PoolConnection;

export type RunResult = {
  meta: {
    changes: number;
  };
};

export class SqlStatement {
  private readonly parameters: DatabaseValue[];

  constructor(
    private readonly sql: string,
    parameters: DatabaseValue[] = [],
  ) {
    this.parameters = parameters;
  }

  bind(...parameters: DatabaseValue[]) {
    return new SqlStatement(this.sql, parameters);
  }

  async all<T>(executor: Executor = getPool()) {
    const [rows] = await executor.execute<RowDataPacket[]>(this.sql, this.parameters);
    return { results: rows as T[] };
  }

  async first<T>(executor: Executor = getPool()) {
    const [rows] = await executor.execute<RowDataPacket[]>(this.sql, this.parameters);
    return (rows[0] as T | undefined) ?? null;
  }

  async run(executor: Executor = getPool()): Promise<RunResult> {
    const [result] = await executor.execute<ResultSetHeader>(this.sql, this.parameters);
    return { meta: { changes: result.affectedRows } };
  }
}

class Database {
  prepare(sql: string) {
    return new SqlStatement(sql);
  }

  async batch(statements: SqlStatement[]) {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const results: RunResult[] = [];
      for (const statement of statements) {
        results.push(await statement.run(connection));
      }
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

let pool: Pool | null = null;
const database = new Database();

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getPool() {
  if (!pool) {
    const port = Number(process.env.DB_PORT || '3306');
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('DB_PORT must be a valid port number.');
    }

    pool = mysql.createPool({
      host: requiredEnvironmentVariable('DB_HOST'),
      port,
      database: requiredEnvironmentVariable('DB_NAME'),
      user: requiredEnvironmentVariable('DB_USER'),
      password: requiredEnvironmentVariable('DB_PASSWORD'),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

export function getDatabase() {
  return database;
}
