import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  auditLogs,
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationDispatches,
  communicationPolicies,
  communicationPreferences,
  communicationTemplates,
  companies,
  conversations,
  customerAiStates,
  leads,
  messages,
  prospects,
  providerWebhookEvents,
  whatsappChannelConfigs,
} from '../../database/drizzle/schema';
import { IntegrationEncryptionService } from '../../infrastructure/security/integration-encryption.service';
import { hashSecret, type ChannelPreference, type MarketingConsent } from './communication-rules';

export type PreferenceRow = typeof communicationPreferences.$inferSelect;
export type DispatchRow = typeof communicationDispatches.$inferSelect;
export type CampaignRow = typeof communicationCampaigns.$inferSelect;
export type TemplateRow = typeof communicationTemplates.$inferSelect;

function uniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

@Injectable()
export class OmnichannelRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  async preferencesForRecipient(tenantId: string, recipient: string): Promise<PreferenceRow[]> {
    return this.db
      .select()
      .from(communicationPreferences)
      .where(
        and(
          eq(communicationPreferences.tenantId, tenantId),
          or(
            eq(communicationPreferences.email, recipient),
            eq(communicationPreferences.phone, recipient),
            eq(communicationPreferences.whatsapp, recipient),
          ),
        ),
      );
  }

  async preferenceForSubject(tenantId: string, subjectType: string, subjectId: string) {
    const [row] = await this.db
      .select()
      .from(communicationPreferences)
      .where(
        and(
          eq(communicationPreferences.tenantId, tenantId),
          eq(communicationPreferences.subjectType, subjectType),
          eq(communicationPreferences.subjectId, subjectId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async savePreference(input: {
    tenantId: string;
    subjectType: string;
    subjectId: string;
    preferredChannel: string | null;
    emailStatus: ChannelPreference;
    smsStatus: ChannelPreference;
    whatsappStatus: ChannelPreference;
    marketingConsent: MarketingConsent;
    marketingConsentSource: string | null;
    marketingConsentAt: Date | null;
    marketingOptOutAt: Date | null;
    marketingEvidence: string | null;
    customerRequestedAt: Date | null;
    restrictions: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    updatedBy: string | null;
  }) {
    const existing = await this.preferenceForSubject(input.tenantId, input.subjectType, input.subjectId);
    if (!existing) {
      const [created] = await this.db.insert(communicationPreferences).values(input).returning();
      return created;
    }
    const [updated] = await this.db
      .update(communicationPreferences)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(communicationPreferences.id, existing.id))
      .returning();
    return updated;
  }

  async listTemplates(tenantId: string) {
    return this.db
      .select()
      .from(communicationTemplates)
      .where(eq(communicationTemplates.tenantId, tenantId))
      .orderBy(desc(communicationTemplates.updatedAt));
  }

  async template(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(communicationTemplates)
      .where(and(eq(communicationTemplates.tenantId, tenantId), eq(communicationTemplates.id, id)))
      .limit(1);
    return row ?? null;
  }

  async insertTemplate(values: typeof communicationTemplates.$inferInsert) {
    const [row] = await this.db.insert(communicationTemplates).values(values).returning();
    return row;
  }

  async listCampaigns(tenantId: string) {
    return this.db
      .select()
      .from(communicationCampaigns)
      .where(eq(communicationCampaigns.tenantId, tenantId))
      .orderBy(desc(communicationCampaigns.updatedAt));
  }

  async campaign(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(communicationCampaigns)
      .where(and(eq(communicationCampaigns.tenantId, tenantId), eq(communicationCampaigns.id, id)))
      .limit(1);
    return row ?? null;
  }

  async insertCampaign(values: typeof communicationCampaigns.$inferInsert) {
    const [row] = await this.db.insert(communicationCampaigns).values(values).returning();
    return row;
  }

  async updateCampaign(tenantId: string, id: string, values: Partial<typeof communicationCampaigns.$inferInsert>) {
    const [row] = await this.db
      .update(communicationCampaigns)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(communicationCampaigns.tenantId, tenantId), eq(communicationCampaigns.id, id)))
      .returning();
    return row ?? null;
  }

  async audienceLeads(tenantId: string, filter: { leadStatus?: string; companyId?: string }) {
    const conditions = [eq(leads.tenantId, tenantId)];
    if (filter.leadStatus) conditions.push(eq(leads.status, filter.leadStatus));
    if (filter.companyId) conditions.push(eq(leads.companyId, filter.companyId));
    return this.db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        phone: leads.phone,
        whatsapp: leads.whatsapp,
        jobTitle: leads.jobTitle,
        companyId: leads.companyId,
        companyName: companies.name,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .where(and(...conditions))
      .limit(201);
  }

  async insertRecipient(values: typeof communicationCampaignRecipients.$inferInsert) {
    try {
      const [row] = await this.db.insert(communicationCampaignRecipients).values(values).returning();
      return { row, duplicate: false as const };
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      return { row: null, duplicate: true as const };
    }
  }

  async recipientCounts(tenantId: string, campaignId: string) {
    const rows = await this.db
      .select({ status: communicationCampaignRecipients.status, total: sql<number>`count(*)::int` })
      .from(communicationCampaignRecipients)
      .where(
        and(
          eq(communicationCampaignRecipients.tenantId, tenantId),
          eq(communicationCampaignRecipients.campaignId, campaignId),
        ),
      )
      .groupBy(communicationCampaignRecipients.status);
    return rows.map((row) => ({ status: row.status, total: Number(row.total) }));
  }

  async findDispatchByKey(tenantId: string, idempotencyKey: string) {
    const [row] = await this.db
      .select()
      .from(communicationDispatches)
      .where(and(eq(communicationDispatches.tenantId, tenantId), eq(communicationDispatches.idempotencyKey, idempotencyKey)))
      .limit(1);
    return row ?? null;
  }

  async dispatch(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(communicationDispatches)
      .where(and(eq(communicationDispatches.tenantId, tenantId), eq(communicationDispatches.id, id)))
      .limit(1);
    return row ?? null;
  }

  async latestDispatchForMessage(tenantId: string, messageId: string) {
    const [row] = await this.db
      .select()
      .from(communicationDispatches)
      .where(and(eq(communicationDispatches.tenantId, tenantId), eq(communicationDispatches.messageId, messageId)))
      .orderBy(desc(communicationDispatches.createdAt))
      .limit(1);
    return row ?? null;
  }

  async dispatchByProviderMessage(tenantId: string, provider: string, providerMessageId: string) {
    const [row] = await this.db
      .select()
      .from(communicationDispatches)
      .where(
        and(
          eq(communicationDispatches.tenantId, tenantId),
          eq(communicationDispatches.provider, provider),
          eq(communicationDispatches.providerMessageId, providerMessageId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insertDispatch(values: typeof communicationDispatches.$inferInsert) {
    try {
      const [row] = await this.db.insert(communicationDispatches).values(values).returning();
      return { row, duplicate: false as const };
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      const existing = await this.findDispatchByKey(values.tenantId, values.idempotencyKey);
      return { row: existing, duplicate: true as const };
    }
  }

  async updateDispatch(tenantId: string, id: string, values: Partial<typeof communicationDispatches.$inferInsert>) {
    const [row] = await this.db
      .update(communicationDispatches)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(communicationDispatches.tenantId, tenantId), eq(communicationDispatches.id, id)))
      .returning();
    return row ?? null;
  }

  async markQueuedIfWaiting(tenantId: string, id: string) {
    const [row] = await this.db
      .update(communicationDispatches)
      .set({ status: 'queued', queuedAt: new Date(), updatedAt: new Date(), errorCode: null, errorDetail: null })
      .where(
        and(
          eq(communicationDispatches.tenantId, tenantId),
          eq(communicationDispatches.id, id),
          sql`${communicationDispatches.status} in ('pending', 'pending_approval', 'failed')`,
        ),
      )
      .returning();
    return row ?? null;
  }

  async findConversation(tenantId: string, channel: string, externalAddress: string) {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.channel, channel),
          eq(conversations.externalAddress, externalAddress),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async conversation(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, id)))
      .limit(1);
    return row ?? null;
  }

  async insertConversation(input: {
    tenantId: string;
    userId?: string | null;
    channel: string;
    title: string;
    externalAddress?: string | null;
    leadId?: string | null;
    prospectId?: string | null;
    companyId?: string | null;
    summary?: string | null;
  }) {
    const [row] = await this.db
      .insert(conversations)
      .values({
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        channel: input.channel,
        title: input.title,
        slug: `${input.channel}-${randomUUID().slice(0, 8)}`,
        externalAddress: input.externalAddress ?? null,
        leadId: input.leadId ?? null,
        prospectId: input.prospectId ?? null,
        companyId: input.companyId ?? null,
        summary: input.summary ?? null,
        status: 'active',
      })
      .returning();
    return row;
  }

  async updateConversation(tenantId: string, id: string, values: Partial<typeof conversations.$inferInsert>) {
    const [row] = await this.db
      .update(conversations)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, id)))
      .returning();
    return row ?? null;
  }

  async insertMessage(values: typeof messages.$inferInsert) {
    const [row] = await this.db.insert(messages).values(values).returning();
    return row;
  }

  async updateMessage(tenantId: string, id: string, values: Partial<typeof messages.$inferInsert>) {
    const [row] = await this.db
      .update(messages)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(messages.tenantId, tenantId), eq(messages.id, id)))
      .returning();
    return row ?? null;
  }

  async claimWebhook(input: { tenantId: string | null; provider: string; eventId: string; payloadHash: string }) {
    try {
      await this.db.insert(providerWebhookEvents).values({
        tenantId: input.tenantId,
        provider: input.provider,
        eventId: input.eventId,
        payloadHash: input.payloadHash,
        status: 'processed',
      });
      return true;
    } catch (error) {
      if (uniqueViolation(error)) return false;
      throw error;
    }
  }

  async matchLead(tenantId: string, contact: string) {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          or(eq(leads.email, contact), eq(leads.phone, contact), eq(leads.whatsapp, contact)),
        ),
      )
      .limit(1);
    if (lead) return { type: 'lead' as const, lead, prospect: null };
    const [prospect] = await this.db
      .select()
      .from(prospects)
      .where(and(eq(prospects.tenantId, tenantId), or(eq(prospects.email, contact), eq(prospects.phone, contact))))
      .limit(1);
    return { type: prospect ? 'prospect' as const : 'none' as const, lead: null, prospect: prospect ?? null };
  }

  async lead(tenantId: string, id: string) {
    const [row] = await this.db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        phone: leads.phone,
        whatsapp: leads.whatsapp,
        jobTitle: leads.jobTitle,
        companyId: leads.companyId,
        companyName: companies.name,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .where(and(eq(leads.tenantId, tenantId), eq(leads.id, id)))
      .limit(1);
    return row ?? null;
  }

  async policy(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(communicationPolicies)
      .where(eq(communicationPolicies.tenantId, tenantId))
      .limit(1);
    return row ?? null;
  }

  async savePolicy(tenantId: string, values: Partial<typeof communicationPolicies.$inferInsert> & { updatedBy: string | null }) {
    const existing = await this.policy(tenantId);
    if (!existing) {
      const [created] = await this.db
        .insert(communicationPolicies)
        .values({
          tenantId,
          quietStartHour: values.quietStartHour ?? null,
          quietEndHour: values.quietEndHour ?? null,
          timeZone: values.timeZone ?? 'UTC',
          maxAutomatedFollowUps: values.maxAutomatedFollowUps ?? 3,
          followUpDelayMinutes: values.followUpDelayMinutes ?? null,
          optOutConfirmationEnabled: values.optOutConfirmationEnabled ?? false,
          updatedBy: values.updatedBy,
        })
        .returning();
      return created;
    }
    const [updated] = await this.db
      .update(communicationPolicies)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(communicationPolicies.id, existing.id))
      .returning();
    return updated;
  }

  async whatsAppPublic(tenantId: string) {
    const [row] = await this.db
      .select({
        phoneNumberId: whatsappChannelConfigs.phoneNumberId,
        businessAccountId: whatsappChannelConfigs.businessAccountId,
        status: whatsappChannelConfigs.status,
        liveVerifiedAt: whatsappChannelConfigs.liveVerifiedAt,
        accessTokenEncrypted: whatsappChannelConfigs.accessTokenEncrypted,
        verifyTokenHash: whatsappChannelConfigs.verifyTokenHash,
      })
      .from(whatsappChannelConfigs)
      .where(eq(whatsappChannelConfigs.tenantId, tenantId))
      .limit(1);
    return row ?? null;
  }

  async whatsAppSecrets(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(whatsappChannelConfigs)
      .where(eq(whatsappChannelConfigs.tenantId, tenantId))
      .limit(1);
    if (!row?.accessTokenEncrypted) return null;
    return {
      phoneNumberId: row.phoneNumberId,
      accessToken: this.encryption.decryptStored(row.accessTokenEncrypted).plaintext,
      appSecret: row.appSecretEncrypted ? this.encryption.decryptStored(row.appSecretEncrypted).plaintext : null,
    };
  }

  async whatsAppByPhoneNumberId(phoneNumberId: string) {
    const [row] = await this.db
      .select()
      .from(whatsappChannelConfigs)
      .where(eq(whatsappChannelConfigs.phoneNumberId, phoneNumberId))
      .limit(1);
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      appSecret: row.appSecretEncrypted ? this.encryption.decryptStored(row.appSecretEncrypted).plaintext : null,
    };
  }

  async whatsAppByVerifyHash(hash: string) {
    const [row] = await this.db
      .select({ tenantId: whatsappChannelConfigs.tenantId })
      .from(whatsappChannelConfigs)
      .where(eq(whatsappChannelConfigs.verifyTokenHash, hash))
      .limit(1);
    return row ?? null;
  }

  async saveWhatsApp(input: {
    tenantId: string;
    phoneNumberId: string;
    businessAccountId: string | null;
    accessToken?: string;
    appSecret?: string;
    verifyToken?: string;
  }) {
    const existing = await this.whatsAppPublic(input.tenantId);
    const values = {
      phoneNumberId: input.phoneNumberId,
      businessAccountId: input.businessAccountId,
      accessTokenEncrypted: input.accessToken ? this.encryption.encrypt(input.accessToken) : undefined,
      appSecretEncrypted: input.appSecret ? this.encryption.encrypt(input.appSecret) : undefined,
      verifyTokenHash: input.verifyToken ? hashSecret(input.verifyToken) : undefined,
      status: 'configured_unverified',
      updatedAt: new Date(),
    };
    if (!existing) {
      if (!input.accessToken || !input.appSecret || !input.verifyToken) return null;
      const [created] = await this.db
        .insert(whatsappChannelConfigs)
        .values({
          tenantId: input.tenantId,
          provider: 'meta_cloud',
          phoneNumberId: input.phoneNumberId,
          businessAccountId: input.businessAccountId,
          accessTokenEncrypted: this.encryption.encrypt(input.accessToken) ?? '',
          appSecretEncrypted: this.encryption.encrypt(input.appSecret) ?? '',
          verifyTokenHash: hashSecret(input.verifyToken),
          status: 'configured_unverified',
        })
        .returning({ id: whatsappChannelConfigs.id, status: whatsappChannelConfigs.status });
      return created;
    }
    await this.db
      .update(whatsappChannelConfigs)
      .set({
        phoneNumberId: values.phoneNumberId,
        businessAccountId: values.businessAccountId,
        ...(values.accessTokenEncrypted ? { accessTokenEncrypted: values.accessTokenEncrypted } : {}),
        ...(values.appSecretEncrypted ? { appSecretEncrypted: values.appSecretEncrypted } : {}),
        ...(values.verifyTokenHash ? { verifyTokenHash: values.verifyTokenHash } : {}),
        status: 'configured_unverified',
        updatedAt: new Date(),
      })
      .where(eq(whatsappChannelConfigs.tenantId, input.tenantId));
    return { id: input.tenantId, status: 'configured_unverified' };
  }

  async markWhatsAppAccepted(tenantId: string) {
    await this.db
      .update(whatsappChannelConfigs)
      .set({ liveVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappChannelConfigs.tenantId, tenantId));
  }

  async audit(input: { tenantId: string; userId: string | null; action: string; entityType: string; entityId?: string | null; description: string }) {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description.slice(0, 500),
      metadata: {},
    });
  }

  async metrics(tenantId: string) {
    const dispatches = await this.db
      .select({
        status: communicationDispatches.status,
        channel: communicationDispatches.channel,
        createdAt: communicationDispatches.createdAt,
        conversationId: communicationDispatches.conversationId,
      })
      .from(communicationDispatches)
      .where(eq(communicationDispatches.tenantId, tenantId));
    const inbound = await this.db
      .select({
        createdAt: messages.createdAt,
        conversationId: messages.conversationId,
        channel: messages.channel,
      })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.direction, 'inbound')));
    const [handoffs] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(customerAiStates)
      .where(and(eq(customerAiStates.tenantId, tenantId), sql`${customerAiStates.handoffAt} is not null`));
    return { dispatches, inbound, handoffs: Number(handoffs?.total ?? 0) };
  }

  async countPriorFollowUps(tenantId: string, conversationId: string) {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(communicationDispatches)
      .where(
        and(
          eq(communicationDispatches.tenantId, tenantId),
          eq(communicationDispatches.conversationId, conversationId),
          eq(communicationDispatches.purpose, 'customer_requested'),
          sql`${communicationDispatches.authorKind} = 'system'`,
        ),
      );
    return Number(row?.total ?? 0);
  }
}
