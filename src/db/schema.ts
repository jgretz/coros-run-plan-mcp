import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { AuthToken } from '../types.ts';

// Single-row token store for the hosted COROS MCP. The MCP mints this token
// on login; persisting it here lets the token survive machine restarts
// (fly machines are ephemeral) without re-logging in on every cold start.
export const corosTokens = pgTable('coros_tokens', {
  id: text('id').primaryKey(), // always 'default' — single-row table
  token: jsonb('token').$type<AuthToken>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
