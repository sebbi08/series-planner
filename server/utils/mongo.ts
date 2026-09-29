import { MongoClient, ObjectId, type Db } from 'mongodb'
import type { SeriesDoc, UserDoc } from './documents'

let db: Db | null = null

function mongoUrl(): string {
  const raw = process.env.DB
  if (!raw) throw new Error('DB environment variable is not set')
  return /^mongodb(\+srv)?:\/\//.test(raw) ? raw : `mongodb://${raw}`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function ensureIndex(database: Db, collection: string, field: string, options: { unique?: boolean } = {}) {
  try {
    await database.collection(collection).createIndex({ [field]: 1 }, options)
  }
  catch (e) {
    console.warn(`[mongo] could not create index on ${collection}.${field}:`, (e as Error).message)
  }
}

async function ensureIndexes(database: Db) {
  await ensureIndex(database, 'Series', 'user')
  await ensureIndex(database, 'Users', 'name', { unique: true })
}

/** Connects with exponential backoff (1s → 30s), forever. The driver handles reconnects after the first success. */
export async function startMongo(): Promise<void> {
  let delay = 1000
  for (;;) {
    const client = new MongoClient(mongoUrl(), { serverSelectionTimeoutMS: 5000 })
    try {
      await client.connect()
      const database = client.db()
      await ensureIndexes(database)
      db = database
      console.info(`[mongo] connected to database "${database.databaseName}"`)
      return
    }
    catch (e) {
      await client.close().catch(() => {})
      console.error(`[mongo] connection failed (${(e as Error).message}); retrying in ${delay / 1000}s`)
      await sleep(delay)
      delay = Math.min(delay * 2, 30_000)
    }
  }
}

export function useDb(): Db {
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  return db
}

export async function pingDb(): Promise<boolean> {
  if (!db) return false
  try {
    await db.command({ ping: 1 })
    return true
  }
  catch {
    return false
  }
}

export const seriesCollection = () => useDb().collection<SeriesDoc>('Series')
export const usersCollection = () => useDb().collection<UserDoc>('Users')

export function parseObjectId(id: string | undefined): ObjectId | null {
  return id && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null
}
