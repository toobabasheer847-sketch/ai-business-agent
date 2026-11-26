import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { companies } from './company.schema';
import { conversations } from './conversation.schema';
import { leads } from './lead.schema';
import { messages } from './message.schema';
import { prospects } from './prospect.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const communicationPreferences = pgTable(
  'communication_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    subjectType: varchar('subject_type', { length: 20 }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    preferredChannel: varchar('preferred_channel', { length: 20 }),
    emailStatus: varchar('email_status', { length: 20 }).notNull().default('unknown'),
    smsStatus: varchar('sms_status', { length: 20 }).notNull().default('unknown'),
    whatsappStatus: varchar('whatsapp_status', { length: 20 }).notNull().default('unknown'),
    marketingConsent: varchar('marketing_consent', { length: 20 }).notNull().default('unknown'),
    marketingConsentSource: varchar('marketing_consent_source', { length: 120 }),
    marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }),
    marketingOptOutAt: timestamp('marketing_opt_out_at', { withTimezone: true }),
    marketingEvidence: varchar('marketing_evidence', { length: 500 }),
    customerRequestedAt: timestamp('customer_requested_at', { withTimezone: true }),
    restrictions: varchar('restrictions', { length: 500 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    whatsapp: varchar('whatsapp', { length: 50 }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('communication_preferences_subject_unique').on(
      table.tenantId,
      table.subjectType,
      table.subjectId,
    ),
    index('communication_preferences_email_idx').on(table.tenantId, table.email),
    index('communication_preferences_phone_idx').on(table.tenantId, table.phone),
  ],
);

export const communicationTemplates = pgTable(
  'communication_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    channel: varchar('channel', { length: 20 }).notNull(),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    content: text('content').notNull(),
    variables: jsonb('variables').notNull(),
    approvalStatus: varchar('approval_status', { length: 20 }).notNull().default('draft'),
    providerTemplateRef: varchar('provider_template_ref', { length: 120 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('communication_templates_tenant_channel_idx').on(table.tenantId, table.channel),
  ],
);

export const communicationCampaigns = pgTable(
  'communication_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    channel: varchar('channel', { length: 20 }).notNull(),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    templateId: uuid('template_id').references(() => communicationTemplates.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    audience: jsonb('audience').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    approvalId: uuid('approval_id'),
    failureReason: varchar('failure_reason', { length: 300 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('communication_campaigns_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const communicationCampaignRecipients = pgTable(
  'communication_campaign_recipients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => communicationCampaigns.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    subjectType: varchar('subject_type', { length: 20 }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    recipient: varchar('recipient', { length: 255 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    dispatchId: uuid('dispatch_id'),
    errorCode: varchar('error_code', { length: 80 }),
    idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('communication_campaign_recipients_key_unique').on(table.tenantId, table.idempotencyKey),
    index('communication_campaign_recipients_campaign_idx').on(table.campaignId, table.status),
  ],
);

export const communicationDispatches = pgTable(
  'communication_dispatches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull(),
    provider: varchar('provider', { length: 40 }),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
    providerMessageId: varchar('provider_message_id', { length: 128 }),
    permanentFailure: boolean('permanent_failure').notNull().default(false),
    errorCode: varchar('error_code', { length: 80 }),
    errorDetail: varchar('error_detail', { length: 400 }),
    approvalId: uuid('approval_id'),
    recipient: varchar('recipient', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 200 }),
    body: text('body').notNull(),
    fromPhoneNumberId: uuid('from_phone_number_id'),
    fromEmail: varchar('from_email', { length: 255 }),
    providerTemplateRef: varchar('provider_template_ref', { length: 120 }),
    authorKind: varchar('author_kind', { length: 20 }).notNull().default('human'),
    campaignId: uuid('campaign_id'),
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('communication_dispatches_key_unique').on(table.tenantId, table.idempotencyKey),
    index('communication_dispatches_tenant_status_idx').on(table.tenantId, table.status),
    index('communication_dispatches_provider_message_idx').on(table.tenantId, table.provider, table.providerMessageId),
  ],
);

export const providerWebhookEvents = pgTable(
  'provider_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull(),
    eventId: varchar('event_id', { length: 180 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('provider_webhook_events_event_unique').on(table.provider, table.eventId),
  ],
);

export const whatsappChannelConfigs = pgTable(
  'whatsapp_channel_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull().default('meta_cloud'),
    phoneNumberId: varchar('phone_number_id', { length: 64 }),
    businessAccountId: varchar('business_account_id', { length: 64 }),
    accessTokenEncrypted: text('access_token_encrypted'),
    appSecretEncrypted: text('app_secret_encrypted'),
    verifyTokenHash: varchar('verify_token_hash', { length: 64 }),
    status: varchar('status', { length: 40 }).notNull().default('not_configured'),
    liveVerifiedAt: timestamp('live_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('whatsapp_channel_configs_tenant_unique').on(table.tenantId)],
);

export const communicationPolicies = pgTable(
  'communication_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    quietStartHour: integer('quiet_start_hour'),
    quietEndHour: integer('quiet_end_hour'),
    timeZone: varchar('time_zone', { length: 80 }).notNull().default('UTC'),
    maxAutomatedFollowUps: integer('max_automated_follow_ups').notNull().default(3),
    followUpDelayMinutes: integer('follow_up_delay_minutes'),
    optOutConfirmationEnabled: boolean('opt_out_confirmation_enabled').notNull().default(false),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('communication_policies_tenant_unique').on(table.tenantId)],
);
