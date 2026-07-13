import "server-only";

import { MongoClient, type Db, type Collection } from "mongodb";
import { serverEnv } from "@/lib/env";
import type { UserDoc } from "@/lib/models";

/**
 * Serverless-safe Mongo connection.
 *
 * Every warm lambda invocation re-imports this module, so a naive
 * `new MongoClient()` per request would open a fresh connection pool each time
 * and exhaust Atlas M0's cap (500 connections) under even light traffic. We
 * stash the *promise* on globalThis so concurrent cold callers all await the
 * same in-flight handshake rather than racing to open several pools.
 */

declare global {
  var __timbreMongo: Promise<MongoClient> | undefined;
  var __timbreIndexes: Promise<void> | undefined;
}

function connect(): Promise<MongoClient> {
  const client = new MongoClient(serverEnv().MONGODB_URI, {
    // Fail fast instead of hanging the whole 10s function budget on a bad URI.
    serverSelectionTimeoutMS: 8_000,
    maxPoolSize: 10,
    retryWrites: true,
  });

  return client.connect().catch((error: unknown) => {
    // Don't cache a rejected promise — otherwise one transient network blip
    // would poison this lambda for the rest of its life.
    globalThis.__timbreMongo = undefined;
    throw error;
  });
}

export function clientPromise(): Promise<MongoClient> {
  globalThis.__timbreMongo ??= connect();
  return globalThis.__timbreMongo;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  return client.db(serverEnv().MONGODB_DB);
}

/**
 * Creates indexes once per lambda, not once per request.
 *
 * The unique index on `firebaseUid` is load-bearing, not an optimisation: the
 * lazy user upsert in `requireUser()` is a find-then-upsert, and two concurrent
 * first requests from the same new user would otherwise both miss and insert two
 * user rows — giving that user two separate voice budgets. The unique index makes
 * the loser of that race fail instead.
 *
 * `createIndex` is idempotent, so re-running it on a warm start is a no-op.
 */
async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await db
    .collection<UserDoc>("users")
    .createIndex({ firebaseUid: 1 }, { unique: true, name: "firebaseUid_unique" });
}

export function indexesReady(): Promise<void> {
  globalThis.__timbreIndexes ??= ensureIndexes().catch((error: unknown) => {
    globalThis.__timbreIndexes = undefined;
    throw error;
  });
  return globalThis.__timbreIndexes;
}

export async function usersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  await indexesReady();
  return db.collection<UserDoc>("users");
}

/** Round-trips the cluster. Used by the health check to prove connectivity. */
export async function pingDb(): Promise<void> {
  const db = await getDb();
  await db.command({ ping: 1 });
}
