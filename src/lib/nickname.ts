/**
 * Nickname rules — shared between the worker (validation + session routing) and
 * the web client (forms + inline editors).
 *
 * A nickname is the *only* handle a session is addressed by (`/feed/:nickname`),
 * so it must be unique and URL-safe. We allow Unicode letters and numbers — so
 * accented names like `Žluťoučký` work — plus a small set of safe separators,
 * and reject everything else (whitespace, `/`, `?`, `#`, `%`, `@`, …) that would
 * make a path segment ambiguous or break the URL.
 */
export const NICKNAME_MAX_LENGTH = 30;

export const NICKNAME_REGEX = /^[\p{L}\p{N}_.-]+$/u;

export const NICKNAME_RULES_MESSAGE =
  "Nickname can only contain letters, numbers, and the characters . _ -";

export const NICKNAME_TOO_LONG_MESSAGE = `Nickname is too long (max ${NICKNAME_MAX_LENGTH} characters)`;

/** Returns an error message for an invalid nickname, or null if it is valid. */
export function nicknameError(value: string): string | null {
  if (value.length === 0) return "Please enter a nickname";
  if (value.length > NICKNAME_MAX_LENGTH) return NICKNAME_TOO_LONG_MESSAGE;
  if (!NICKNAME_REGEX.test(value)) return NICKNAME_RULES_MESSAGE;
  return null;
}

export function isValidNickname(value: string): boolean {
  return nicknameError(value) === null;
}
