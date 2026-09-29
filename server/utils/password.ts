import { hashPassword, verifyLegacyPassword, verifyPasswordHash } from '~~/lib/password.mjs'
import type { UserDoc } from './documents'

/** Verifies against passwordHash, else the legacy sha256 field. On a legacy match, returns a new scrypt hash to store. */
export async function checkUserPassword(user: UserDoc, password: string): Promise<{ ok: boolean, upgradedHash?: string }> {
  if (user.passwordHash) return { ok: await verifyPasswordHash(user.passwordHash, password) }
  if (user.password && verifyLegacyPassword(user.password, password)) {
    return { ok: true, upgradedHash: await hashPassword(password) }
  }
  return { ok: false }
}
