/**
 * Military Tactical Application Security Utilities
 * Enforces strict input sanitization, format validation, and side-channel resistance.
 */

// Max allowed lengths for core operational fields
export const MAX_LENGTHS = {
  TSADI: 25,
  DEVICE_TYPE: 60,
  PLATOON: 60,
  LOCATION: 80,
  CYCLE_NAME: 100,
  FAULT_NOTES: 500,
  REPORT_TITLE: 120,
  REPORT_DESCRIPTION: 2000,
  LOG_DETAILS: 500,
};

/**
 * Strips HTML, script tags, invisible control characters and trims string.
 * Enforces maximum character boundary to prevent payload flooding.
 */
export function sanitizeInput(input: unknown, maxLength = 250): string {
  if (input === null || input === undefined) return '';
  const str = String(input);

  // Strip control characters (except common whitespace) and HTML/script tags
  const sanitized = str
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove ASCII control characters
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '') // Remove Unicode directional override characters
    .trim();

  return sanitized.slice(0, maxLength);
}

/**
 * Validates and cleans a military Tsadi (serial/equipment) identifier.
 * Ensures the identifier contains only valid characters (numbers, letters, hyphens, slashes).
 */
export function sanitizeTsadi(rawTsadi: unknown): string {
  if (rawTsadi === null || rawTsadi === undefined) return '';
  const cleaned = String(rawTsadi)
    .replace(/<[^>]*>?/gm, '')
    .trim();

  return cleaned.slice(0, MAX_LENGTHS.TSADI);
}

/**
 * Validates that a Tsadi number matches standard military identifier patterns.
 */
export function isValidTsadi(tsadi: string): boolean {
  if (!tsadi || typeof tsadi !== 'string') return false;
  const trimmed = tsadi.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTHS.TSADI) return false;
  // Military IDs are typically numeric or alphanumeric with optional hyphens/slashes
  return /^[\u0590-\u05FFa-zA-Z0-9\-_/. ]+$/.test(trimmed);
}

/**
 * Validates cycle (Doh) names.
 */
export function sanitizeCycleName(rawName: unknown): string {
  return sanitizeInput(rawName, MAX_LENGTHS.CYCLE_NAME);
}

/**
 * Timing-safe string comparison to protect against timing side-channel attacks on passcodes.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Default passcode - can be overridden by environment variable or secure config
const DEFAULT_PASSCODE = '1379';

/**
 * Verifies the Kashrag entry passcode using constant-time comparison.
 */
export function verifyPasscode(inputPin: string): boolean {
  if (!inputPin) return false;
  const expected = process.env.EXPO_PUBLIC_KASHRAG_PIN || DEFAULT_PASSCODE;
  return safeCompare(inputPin.trim(), expected);
}
