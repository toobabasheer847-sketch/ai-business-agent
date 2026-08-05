import { relations } from 'drizzle-orm';

import { tenants } from '../schema/tenant.schema';
import { users } from '../schema/user.schema';
import { brands } from '../schema/brand.schema';
import { knowledgebases } from '../schema/knowledgebase.schema';
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

export const tenantRelations = relations(tenants, ({ many, one }) => ({
  users: many(users),
  brand: one(brands),
  knowledgebases: many(knowledgebases),
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
}));

export const userRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),

  conversations: many(conversations),
  messages: many(messages),
  proposals: many(proposals),
  auditLogs: many(auditLogs),
}));

export const brandRelations = relations(brands, ({ one }) => ({
  tenant: one(tenants, {
    fields: [brands.tenantId],
    references: [tenants.id],
  }),
}));

export const knowledgebaseRelations = relations(
  knowledgebases,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [knowledgebases.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const companyRelations = relations(companies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [companies.tenantId],
    references: [tenants.id],
  }),

  leads: many(leads),
  prospects: many(prospects),
}));

export const leadRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),

  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  
  prospects: many(prospects),
}));

export const prospectRelations = relations(prospects, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [prospects.tenantId],
    references: [tenants.id],
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
}));

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

export const messageRelations = relations(messages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),

  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),

  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const proposalRelations = relations(proposals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [proposals.tenantId],
    references: [tenants.id],
  }),

  prospect: one(prospects, {
    fields: [proposals.prospectId],
    references: [prospects.id],
  }),

  creator: one(users, {
    fields: [proposals.createdBy],
    references: [users.id],
  }),
}));

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

export const twilioAppRelations = relations(
  twilioApps,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [twilioApps.tenantId],
      references: [tenants.id],
    }),

    phoneNumber: one(phoneNumbers, {
      fields: [twilioApps.phoneNumberId],
      references: [phoneNumbers.id],
    }),
  }),
);

export const gmailConfigRelations = relations(
  gmailConfigs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [gmailConfigs.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const auditLogRelations = relations(
  auditLogs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [auditLogs.tenantId],
      references: [tenants.id],
    }),

    user: one(users, {
      fields: [auditLogs.userId],
      references: [users.id],
    }),
  }),
);