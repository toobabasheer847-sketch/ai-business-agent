import { relations } from 'drizzle-orm';

import { tenants } from '../schema/tenant.schema';
import { users } from '../schema/user.schema';
import { brands } from '../schema/brand.schema';
import { knowledgebases } from '../schema/knowledgebase.schema';
import { knowledgeDocuments } from '../schema/knowledge-document.schema';
import { knowledgeChunks } from '../schema/knowledge-chunk.schema';
import { companies } from '../schema/company.schema';
import { leads } from '../schema/lead.schema';
import { prospects } from '../schema/prospect.schema';
import { conversations } from '../schema/conversation.schema';
import { messages } from '../schema/message.schema';
import { proposals } from '../schema/proposal.schema';
import { phoneNumbers } from '../schema/phone-number.schema';
import { twilioApps } from '../schema/twilio-app.schema';
import { gmailConfigs } from '../schema/gmail-config.schema';
import { auditLogs } from '../schema/audit-log.schema';
import { tasks } from '../schema/task.schema';

/**
 * Tenant relations
 */
export const tenantRelations = relations(
  tenants,
  ({ many, one }) => ({
    users: many(users),
    brand: one(brands),
    knowledgebases: many(knowledgebases),
    knowledgeDocuments: many(knowledgeDocuments),
    knowledgeChunks: many(knowledgeChunks),
    companies: many(companies),
    leads: many(leads),
    prospects: many(prospects),
    conversations: many(conversations),
    messages: many(messages),
    proposals: many(proposals),
    phoneNumbers: many(phoneNumbers),
    twilioApps: many(twilioApps),
    gmailConfigs: many(gmailConfigs),
    auditLogs: many(auditLogs),
    tasks: many(tasks),
  }),
);

/**
 * User relations
 */
export const userRelations = relations(
  users,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [users.tenantId],
      references: [tenants.id],
    }),

    conversations: many(conversations),
    messages: many(messages),
    proposals: many(proposals),
    auditLogs: many(auditLogs),
    createdTasks: many(tasks, { relationName: 'createdTasks' }),
    assignedTasks: many(tasks, { relationName: 'assignedTasks' }),
  }),
);

/**
 * Brand relations
 */
export const brandRelations = relations(
  brands,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [brands.tenantId],
      references: [tenants.id],
    }),
  }),
);

/**
 * Knowledge base relations
 */
export const knowledgebaseRelations = relations(
  knowledgebases,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [knowledgebases.tenantId],
      references: [knowledgebases.id],
    }),
  }),
);

/**
 * Knowledge document relations
 */
export const knowledgeDocumentRelations = relations(
  knowledgeDocuments,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [knowledgeDocuments.tenantId],
      references: [tenants.id],
    }),

    knowledgeBase: one(knowledgebases, {
      fields: [knowledgeDocuments.knowledgeBaseId],
      references: [knowledgebases.id],
    }),

    chunks: many(knowledgeChunks),
  }),
);

/**
 * Knowledge chunk relations
 */
export const knowledgeChunkRelations = relations(
  knowledgeChunks,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [knowledgeChunks.tenantId],
      references: [knowledgeChunks.id],
    }),

    knowledgeBase: one(knowledgebases, {
      fields: [knowledgeChunks.knowledgeBaseId],
      references: [knowledgebases.id],
    }),

    document: one(knowledgeDocuments, {
      fields: [knowledgeChunks.documentId],
      references: [knowledgeDocuments.id],
    }),
  }),
);

/**
 * Company relations
 */
export const companyRelations = relations(
  companies,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [companies.tenantId],
      references: [companies.id],
    }),

    leads: many(leads),
    prospects: many(prospects),
  }),
);

/**
 * Lead relations
 */
export const leadRelations = relations(
  leads,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [leads.tenantId],
      references: [leads.id],
    }),

    company: one(companies, {
      fields: [leads.companyId],
      references: [companies.id],
    }),

    prospects: many(prospects),
  }),
);

/**
 * Prospect relations
 */
export const prospectRelations = relations(
  prospects,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [prospects.tenantId],
      references: [prospects.id],
    }),

    company: one(companies, {
      fields: [prospects.companyId],
      references: [companies.id],
    }),

    lead: one(leads, {
      fields: [prospects.leadId],
      references: [leads.id],
    }),

    conversations: many(conversations),
    proposals: many(proposals),
  }),
);

/**
 * Conversation relations
 */
export const conversationRelations = relations(
  conversations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [conversations.tenantId],
      references: [tenants.id],
    }),

    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),

    prospect: one(prospects, {
      fields: [conversations.prospectId],
      references: [prospects.id],
    }),

    messages: many(messages),
  }),
);

/**
 * Message relations
 */
export const messageRelations = relations(
  messages,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [messages.tenantId],
      references: [messages.id],
    }),

    conversation: one(conversations, {
      fields: [messages.conversationId],
      references: [conversations.id],
    }),

    user: one(users, {
      fields: [messages.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Proposal relations
 */
export const proposalRelations = relations(
  proposals,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [proposals.tenantId],
      references: [proposals.id],
    }),

    prospect: one(prospects, {
      fields: [proposals.prospectId],
      references: [proposals.id],
    }),

    creator: one(users, {
      fields: [proposals.createdBy],
      references: [users.id],
    }),
  }),
);

/**
 * Phone number relations
 */
export const phoneNumberRelations = relations(
  phoneNumbers,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [phoneNumbers.tenantId],
      references: [tenants.id],
    }),

    twilioApps: many(twilioApps),
  }),
);

/**
 * Twilio app relations
 */
export const twilioAppRelations = relations(
  twilioApps,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [twilioApps.tenantId],
      references: [twilioApps.id],
    }),

    phoneNumber: one(phoneNumbers, {
      fields: [twilioApps.phoneNumberId],
      references: [phoneNumbers.id],
    }),
  }),
);

/**
 * Gmail configuration relations
 */
export const gmailConfigRelations = relations(
  gmailConfigs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [gmailConfigs.tenantId],
      references: [tenants.id],
    }),
  }),
);

/**
 * Audit log relations
 */
export const auditLogRelations = relations(
  auditLogs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [auditLogs.tenantId],
      references: [auditLogs.id],
    }),

    user: one(users, {
      fields: [auditLogs.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Task relations
 */
export const taskRelations = relations(
  tasks,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tasks.tenantId],
      references: [tasks.id],
    }),

    creator: one(users, {
      fields: [tasks.createdBy],
      references: [users.id],
      relationName: 'createdTasks',
    }),

    assignee: one(users, {
      fields: [tasks.assignedTo],
      references: [users.id],
      relationName: 'assignedTasks',
    }),
  }),
);
