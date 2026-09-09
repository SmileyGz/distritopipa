// lib/config.ts
// Centralized store and banking configuration

export const BANK_CONFIG = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'Hey Banco',
  clabe: process.env.NEXT_PUBLIC_CLABE_NUMBER || '167691000009770036',
  recipient: process.env.NEXT_PUBLIC_BANK_RECIPIENT || 'José Luis',

  /** Returns the CLABE formatted with spaces for readability (e.g. 1676 9100 0009 7700 36) */
  get formattedClabe(): string {
    const raw = this.clabe.replace(/\s+/g, '')
    if (raw.length === 18) {
      return `${raw.slice(0, 4)} ${raw.slice(4, 8)} ${raw.slice(8, 12)} ${raw.slice(12, 16)} ${raw.slice(16)}`
    }
    return raw
  }
}
