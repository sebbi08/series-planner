#!/usr/bin/env node
// Usage: DB=... node scripts/create-user.mjs <name> [--legacy]
//   --legacy  also write the old app's sha256 `password` + `salt`, so the user can log into the OLD app too.
// Works with a TTY (echo suppressed) and with piped stdin (two lines: password, repeat).
import { MongoClient } from 'mongodb'
import { createInterface } from 'node:readline'
import { hashPassword, legacySha256Hex, randomLegacySalt } from '../lib/password.mjs'

const args = process.argv.slice(2)
const legacy = args.includes('--legacy')
const name = args.find(a => !a.startsWith('--'))
if (!name) {
  console.error('Usage: node scripts/create-user.mjs <name> [--legacy]')
  process.exit(1)
}
if (!process.env.DB) {
  console.error('DB environment variable is not set')
  process.exit(1)
}

// One readline interface for both lines: separate interfaces lose buffered input when stdin is piped.
const tty = Boolean(process.stdin.isTTY)
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty })
if (tty) {
  rl._writeToOutput = (s) => { if (s.includes('Password: ') || s.includes('Repeat password: ')) process.stdout.write(s) }
}
const lines = rl[Symbol.asyncIterator]()
async function prompt(question) {
  process.stdout.write(question)
  const { value, done } = await lines.next()
  if (tty) process.stdout.write('\n')
  return done ? '' : value
}

const password = await prompt('Password: ')
const confirm = await prompt('Repeat password: ')
rl.close()
if (password !== confirm) { console.error('Passwords do not match'); process.exit(1) }
if (password.length < 8) { console.error('Password must have at least 8 characters'); process.exit(1) }

const url = /^mongodb(\+srv)?:\/\//.test(process.env.DB) ? process.env.DB : `mongodb://${process.env.DB}`
const client = new MongoClient(url)
try {
  await client.connect()
  const users = client.db().collection('Users')
  if (await users.findOne({ name })) { console.error(`User "${name}" already exists`); process.exit(1) }
  const doc = { name, passwordHash: await hashPassword(password) }
  if (legacy) Object.assign(doc, { password: legacySha256Hex(password), salt: randomLegacySalt() })
  await users.insertOne(doc)
  console.log(`Created user "${name}"${legacy ? ' (with legacy hash for the old app)' : ''}`)
}
finally {
  await client.close()
}
