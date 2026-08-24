import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

type Db = LibSQLDatabase<typeof schema>;

function createDb(): Db {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL environment variable is not set");
  }
  const client: Client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return drizzle(client, { schema });
}

declare global {
  var __db: Db | undefined;
}

function ensureDb(): Db {
  // Reuse the instance across hot reloads / serverless invocations in the same process.
  if (!globalThis.__db) {
    globalThis.__db = createDb();
  }
  return globalThis.__db;
}

// A lazy proxy: importing this module must never throw (that would crash
// route handlers before their own try/catch runs, producing an empty
// response body instead of a readable error). The env var is only read -
// and can only throw - the first time a query actually runs, inside the
// caller's try/catch.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = ensureDb();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
