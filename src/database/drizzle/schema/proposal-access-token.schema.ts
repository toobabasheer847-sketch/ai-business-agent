import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { proposals } from './proposal.schema';

/**
 * Public proposal links. Only the SHA-256 hash of the token is stored.
 * The plaintext token exists in the email URL and is never written here.
 */
export const proposalAccessTokens = pgTable(
  'proposal_access_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    tokenHash: varchar('token_hash', { length: 64 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('proposal_access_tokens_token_hash_unique').on(table.tokenHash),
    tenantIdIdx: index('proposal_access_tokens_tenant_id_idx').on(table.tenantId),
    proposalIdIdx: index('proposal_access_tokens_proposal_id_idx').on(table.proposalId),
  }),
);
