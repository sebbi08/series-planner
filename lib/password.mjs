// Password hashing shared by the Nitro server and scripts/create-user.mjs. node:crypto only — no dependencies.
import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64

/** @returns {Promise<string>} "scrypt$N$r$p$saltB64$hashB64" */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPasswordHash(hash, password) {
  try {
    const parts = String(hash).split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const [, n, r, p, saltB64, keyB64] = parts
    if (Number(n) !== N || Number(r) !== R || Number(p) !== P) return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(keyB64, 'base64')
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false
    const actual = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P })
    return timingSafeEqual(actual, expected)
  }
  catch {
    return false
  }
}

/** The old app's hash: CryptoJS.SHA256(password, salt) ignores the salt → plain sha256 hex. */
export function legacySha256Hex(password) {
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

export function verifyLegacyPassword(storedHex, password) {
  const a = Buffer.from(legacySha256Hex(password))
  const b = Buffer.from(String(storedHex ?? ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Same alphabet/length as the old app's createSalt(). Only written by `create-user --legacy`. */
export function randomLegacySalt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-;,:.#*+~'
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('')
}
