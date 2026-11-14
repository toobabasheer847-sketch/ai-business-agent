import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes, base64url, no padding. 256 bits of entropy. */
const TOKEN_BYTES = 32;

export const PROPOSAL_ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateProposalAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashProposalAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedProposalToken(token: string): boolean {
  return PROPOSAL_ACCESS_TOKEN_PATTERN.test(token);
}
