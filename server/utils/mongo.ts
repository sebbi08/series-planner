import { MongoClient, ObjectId, type Db } from 'mongodb'
import type { SeriesDoc, UserDoc } from './documents'

let db: Db | null = null

function mongoUrl(): string {
  const raw = process.env.DB
  if (!raw) throw new Error('DB environment variable is not set')
  return /^mongodb(\+srv)?:\/\//.test(raw) ? raw : `mongodb://${raw}`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function ensureIndexes(database: Db) {
  await database.collection('Series').createIndex({ user: 1 })
  try {
    await database.collection('Users').createIndex({ name: 1 }, { unique: true })
  }
  catch (e) {
    console.warn('[mongo] could not create unique index on Users.name:', (e as Error).message)
  }
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
