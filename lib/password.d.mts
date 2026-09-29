export declare function hashPassword(password: string): Promise<string>
export declare function verifyPasswordHash(hash: string, password: string): Promise<boolean>
export declare function legacySha256Hex(password: string): string
export declare function verifyLegacyPassword(storedHex: string | undefined, password: string): boolean
export declare function randomLegacySalt(): string
