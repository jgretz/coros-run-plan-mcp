import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

type Db = PostgresJsDatabase<typeof schema>;

let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = postgres(url);
  db = drizzle(client, { schema });
  return db;
}
