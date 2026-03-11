import { randomBytes, createHash } from 'crypto'

/**
 * Generate PKCE (Proof Key for Code Exchange) parameters.
 * Used by Codex, Gemini, and Antigravity OAuth flows.
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // 43-128 characters from unreserved URI characters
  const codeVerifier = randomBytes(32)
    .toString('base64url')
    .slice(0, 64)

  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return { codeVerifier, codeChallenge }
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  return randomBytes(16).toString('hex')
}
