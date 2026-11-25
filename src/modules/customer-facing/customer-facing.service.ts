import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, sql } from 'drizzle-orm';

import { AgentRunTracker } from '../../ai/monitoring/agent-run.tracker';
import { RagTools } from '../../ai/agents/rag/rag.tools';
import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { auditLogs } from '../../database/drizzle/schema/audit-log.schema';
import { companies } from '../../database/drizzle/schema/company.schema';
import { conversations } from '../../database/drizzle/schema/conversation.schema';
import {
  customerAiSettings,
  customerAiStates,
  customerChatSessions,
} from '../../database/drizzle/schema/customer-facing.schema';
import { knowledgebases } from '../../database/drizzle/schema/knowledgebase.schema';
import { leads } from '../../database/drizzle/schema/lead.schema';
import { messages } from '../../database/drizzle/schema/message.schema';
import { users } from '../../database/drizzle/schema/user.schema';
import { hasAnyPermission, hasPermission, Permission } from '../authorization/permissions';
import { LeadService } from '../lead/lead.service';
import { WorkflowService } from '../workflows/workflow.service';
import {
  CUSTOMER_CHANNEL,
  LEAD_SOURCE,
  publicAccent,
  acceptGroundedRewrite,
  assertMessageText,
  classifyIntent,
  excerptsFromChunks,
  generatePublicKey,
  generatePublicToken,
  groundedAnswer,
  handoffReason,
  hashSessionToken,
  isWellFormedPublicKey,
  isWellFormedSessionToken,
  leadReadiness,
  needsHuman,
  publicView,
  sessionExpiry,
  sessionUsable,
  splitName,
  summarizeMessages,
} from './customer-facing';

type Actor = { tenantId: string; userId: string; role?: string };

@Injectable()
export class CustomerFacingService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
    private readonly leads: LeadService,
    private readonly workflows: WorkflowService,
    @Optional() private readonly knowledge?: RagTools,
    @Optional() private readonly tracker?: AgentRunTracker,
  ) {}

  async bootstrap(publicKey: string) {
    const settings = await this.settingsByKey(publicKey);
    return publicView(settings);
  }

  async start(publicKey: string) {
    const settings = await this.settingsByKey(publicKey);
    if (!settings.enabled) throw new ForbiddenException('This chat is not available.');
    const token = generatePublicToken();
    const conversationRows = await this.db
      .insert(conversations)
      .values({
        tenantId: settings.tenantId,
        title: 'Customer chat',
        slug: `customer-${generatePublicKey()}`,
        channel: CUSTOMER_CHANNEL,
        status: 'open',
        summary: 'No customer message is stored.',
      })
      .returning();
    const conversation = conversationRows[0];
    await this.db.insert(customerChatSessions).values({
      tenantId: settings.tenantId,
      conversationId: conversation.id,
      tokenHash: hashSessionToken(token),
      expiresAt: sessionExpiry(),
    });
    await this.db.insert(customerAiStates).values({
      tenantId: settings.tenantId,
      conversationId: conversation.id,
      intent: 'other',
      confidence: 'LOW',
      intentSource: 'rules',
      intentEvidence: 'The conversation has no customer message yet.',
      summary: 'No customer message is stored.',
      status: 'open',
    });
    await this.audit(settings.tenantId, null, 'customer.conversation.started', conversation.id, 'A public customer conversation started.');
    await this.workflows.dispatchEvent(settings.tenantId, 'customer_conversation_started', `customer-start:${conversation.id}`);
    return { sessionToken: token, expiresInDays: 7, ...publicView(settings) };
  }

  async history(publicKey: string, token: string) {
    const session = await this.requireSession(token, publicKey);
    const rows = await this.visibleMessages(session.tenantId, session.conversationId);
    const state = await this.requireState(session.tenantId, session.conversationId);
    return {
      messages: rows.map(presentMessage),
      status: state.status,
      handoff: Boolean(state.handoffAt),
      handoffNote: state.handoffAt ? 'A teammate has been asked to help. A person has not replied in this chat yet.' : null,
      disclosure: 'You are talking with an AI assistant.',
    };
  }

  async send(publicKey: string, token: string, content: string) {
    const error = assertMessageText(content);
    if (error) throw new BadRequestException(error);
    const session = await this.requireSession(token, publicKey);
    const state = await this.requireState(session.tenantId, session.conversationId);
    if (state.status === 'resolved') throw new ConflictException('This conversation is closed.');
    const text = content.trim();
    await this.addMessage(session.tenantId, session.conversationId, 'human', text);
    const intent = classifyIntent(text);
    const settings = await this.requireSettings(session.tenantId);
    if (!settings.enabled) throw new ForbiddenException('This chat is not available.');
    const excerpts = await this.lookup(session.tenantId, settings.knowledgeBaseId, text);
    const draft = groundedAnswer(text, excerpts);
    const answer = await this.narrate(session.tenantId, draft.text, excerpts.map((item) => item.text).join('\n'), settings.instructions);
    await this.addMessage(session.tenantId, session.conversationId, 'ai', answer);
    const reason = handoffReason(intent.intent, draft.unanswered);
    const alreadyHandedOff = Boolean(state.handoffAt);
    const handoff = state.status === 'handoff' || needsHuman(intent.intent, draft.unanswered);
    const status = handoff ? 'handoff' : 'open';
    const summary = await this.refreshSummary(session.tenantId, session.conversationId);
    await this.db
      .update(customerAiStates)
      .set({
        intent: draft.unanswered && intent.intent === 'other' ? 'unresolved' : intent.intent,
        confidence: intent.confidence,
        intentSource: 'rules',
        intentEvidence: intent.evidence,
        handoffReason: handoff ? state.handoffReason ?? reason : state.handoffReason,
        handoffAt: handoff ? state.handoffAt ?? new Date() : state.handoffAt,
        summary: summary.text,
        status,
        requirements: summary.requirements || state.requirements,
        updatedAt: new Date(),
      })
      .where(eq(customerAiStates.id, state.id));
    await this.db.update(conversations).set({ summary: summary.text, status, updatedAt: new Date() }).where(eq(conversations.id, session.conversationId));
    if (handoff && !alreadyHandedOff) {
      await this.audit(session.tenantId, null, 'customer.handoff', session.conversationId, reason ?? 'Human help was requested.');
      if (settings.handoffNotificationsEnabled) {
        await this.workflows.dispatchEvent(session.tenantId, 'customer_handoff', `customer-handoff:${session.conversationId}`);
      }
    }
    if (intent.intent === 'complaint') {
      await this.workflows.dispatchEvent(session.tenantId, 'customer_complaint', `customer-complaint:${session.conversationId}`);
    }
    if (draft.unanswered) {
      await this.workflows.dispatchEvent(session.tenantId, 'customer_unresolved', `customer-unresolved:${session.conversationId}`);
    }
    return {
      reply: answer,
      intent: intent.intent,
      confidence: intent.confidence,
      unanswered: draft.unanswered,
      handoff,
      handoffNote: handoff ? 'A teammate has been asked to help. A person has not replied in this chat yet.' : null,
    };
  }

  async details(publicKey: string, token: string, input: { name?: string; email?: string; phone?: string; requirements?: string }) {
    const session = await this.requireSession(token, publicKey);
    const state = await this.requireState(session.tenantId, session.conversationId);
    const name = clean(input.name, 120);
    const email = clean(input.email, 255)?.toLowerCase() ?? null;
    const phone = clean(input.phone, 50);
    const requirements = clean(input.requirements, 1000);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('That email address is not valid.');
    await this.db
      .update(customerAiStates)
      .set({
        visitorName: name ?? state.visitorName,
        visitorEmail: email ?? state.visitorEmail,
        visitorPhone: phone ?? state.visitorPhone,
        requirements: requirements ?? state.requirements,
        updatedAt: new Date(),
      })
      .where(eq(customerAiStates.id, state.id));
    const next = await this.requireState(session.tenantId, session.conversationId);
    const lead = await this.captureLead(session.tenantId, next);
    return { saved: true, leadCreated: lead.created, leadLinked: Boolean(lead.id), reason: lead.reason };
  }

  async requestHuman(publicKey: string, token: string) {
    const session = await this.requireSession(token, publicKey);
    const state = await this.requireState(session.tenantId, session.conversationId);
    if (state.status === 'resolved') throw new ConflictException('This conversation is closed.');
    const reason = 'The visitor asked for a person.';
    const alreadyHandedOff = Boolean(state.handoffAt);
    await this.db
      .update(customerAiStates)
      .set({
        intent: 'human_assistance',
        confidence: 'HIGH',
        intentSource: 'visitor',
        intentEvidence: reason,
        handoffReason: reason,
        handoffAt: state.handoffAt ?? new Date(),
        status: 'handoff',
        updatedAt: new Date(),
      })
      .where(eq(customerAiStates.id, state.id));
    await this.addMessage(session.tenantId, session.conversationId, 'ai', 'I have asked a teammate to continue this conversation. A person has not replied in this chat yet.');
    if (!alreadyHandedOff) {
      await this.audit(session.tenantId, null, 'customer.handoff', session.conversationId, reason);
      const settings = await this.requireSettings(session.tenantId);
      if (settings.handoffNotificationsEnabled) {
        await this.workflows.dispatchEvent(session.tenantId, 'customer_handoff', `customer-handoff:${session.conversationId}`);
      }
    }
    return { handoff: true, handoffNote: 'A teammate has been asked to help. A person has not replied in this chat yet.' };
  }

  async end(publicKey: string, token: string) {
    const session = await this.requireSession(token, publicKey);
    await this.db.update(customerChatSessions).set({ endedAt: new Date() }).where(eq(customerChatSessions.id, session.id));
    await this.db.update(customerAiStates).set({ status: 'resolved', updatedAt: new Date() }).where(and(eq(customerAiStates.tenantId, session.tenantId), eq(customerAiStates.conversationId, session.conversationId)));
    await this.db.update(conversations).set({ status: 'resolved', updatedAt: new Date() }).where(eq(conversations.id, session.conversationId));
    await this.workflows.dispatchEvent(session.tenantId, 'customer_resolved', `customer-resolved:${session.conversationId}`);
    return { ended: true };
  }

  async list(actor: Actor, status?: string) {
    this.allowAny(actor, [Permission.CommunicationView, Permission.CommunicationViewOwn]);
    const filters = [eq(customerAiStates.tenantId, actor.tenantId)];
    if (status) filters.push(eq(customerAiStates.status, status));
    const rows = await this.db
      .select({
        conversationId: customerAiStates.conversationId,
        status: customerAiStates.status,
        intent: customerAiStates.intent,
        confidence: customerAiStates.confidence,
        visitorName: customerAiStates.visitorName,
        visitorEmail: customerAiStates.visitorEmail,
        leadId: customerAiStates.leadId,
        handoffAt: customerAiStates.handoffAt,
        summary: customerAiStates.summary,
        updatedAt: customerAiStates.updatedAt,
        title: conversations.title,
      })
      .from(customerAiStates)
      .innerJoin(conversations, eq(conversations.id, customerAiStates.conversationId))
      .where(and(...filters))
      .orderBy(desc(customerAiStates.updatedAt))
      .limit(50);
    return { data: rows };
  }

  async detail(actor: Actor, conversationId: string) {
    this.allowAny(actor, [Permission.CommunicationView, Permission.CommunicationViewOwn]);
    const state = await this.requireState(actor.tenantId, conversationId);
    const transcript = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, actor.tenantId), eq(messages.conversationId, conversationId)))
      .orderBy(messages.createdAt);
    return {
      ...state,
      messages: transcript.map((row) => ({ id: row.id, role: row.role, content: row.content, createdAt: row.createdAt })),
    };
  }

  async assign(actor: Actor, conversationId: string, userId: string) {
    this.allowAny(actor, [Permission.CommunicationView, Permission.CommunicationViewOwn]);
    const state = await this.requireState(actor.tenantId, conversationId);
    const member = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId))).limit(1);
    if (!member[0]) throw new BadRequestException('That team member is not in this business.');
    await this.db.update(customerAiStates).set({ assignedUserId: userId, updatedAt: new Date() }).where(eq(customerAiStates.id, state.id));
    await this.audit(actor.tenantId, actor.userId, 'customer.assigned', conversationId, 'A customer conversation was assigned.');
    return { assignedUserId: userId };
  }

  async resolve(actor: Actor, conversationId: string) {
    this.allowAny(actor, [Permission.CommunicationView, Permission.CommunicationViewOwn]);
    await this.requireState(actor.tenantId, conversationId);
    await this.db.update(customerAiStates).set({ status: 'resolved', updatedAt: new Date() }).where(and(eq(customerAiStates.tenantId, actor.tenantId), eq(customerAiStates.conversationId, conversationId)));
    await this.db.update(conversations).set({ status: 'resolved', updatedAt: new Date() }).where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, actor.tenantId)));
    await this.workflows.dispatchEvent(actor.tenantId, 'customer_resolved', `customer-resolved:${conversationId}`);
    return { status: 'resolved' };
  }

  async reopen(actor: Actor, conversationId: string) {
    this.allowAny(actor, [Permission.CommunicationView, Permission.CommunicationViewOwn]);
    await this.requireState(actor.tenantId, conversationId);
    await this.db.update(customerAiStates).set({ status: 'open', updatedAt: new Date() }).where(and(eq(customerAiStates.tenantId, actor.tenantId), eq(customerAiStates.conversationId, conversationId)));
    await this.db.update(conversations).set({ status: 'open', updatedAt: new Date() }).where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, actor.tenantId)));
    return { status: 'open' };
  }

  async note(actor: Actor, conversationId: string, content: string) {
    this.allowAny(actor, [Permission.CommunicationView, Permission.CommunicationViewOwn]);
    const error = assertMessageText(content);
    if (error) throw new BadRequestException(error);
    await this.requireState(actor.tenantId, conversationId);
    await this.addMessage(actor.tenantId, conversationId, 'internal', content.trim(), actor.userId);
    return { saved: true };
  }

  async getSettings(actor: Actor) {
    this.allow(actor, Permission.BrandManage);
    return this.ensureSettings(actor.tenantId);
  }

  async updateSettings(actor: Actor, input: SettingsInput) {
    this.allow(actor, Permission.BrandManage);
    const current = await this.ensureSettings(actor.tenantId);
    if (input.companyId) await this.requireCompany(actor.tenantId, input.companyId);
    if (input.knowledgeBaseId) await this.requireKnowledgeBase(actor.tenantId, input.knowledgeBaseId);
    if (input.accent !== undefined && publicAccent(input.accent) !== input.accent) {
      throw new BadRequestException('Choose slate, blue, or emerald for the chat appearance.');
    }
    const rows = await this.db
      .update(customerAiSettings)
      .set({
        enabled: input.enabled ?? current.enabled,
        displayName: clip(input.displayName, 80) ?? current.displayName,
        welcomeMessage: clip(input.welcomeMessage, 400) ?? current.welcomeMessage,
        instructions: input.instructions !== undefined ? input.instructions.slice(0, 1000) : current.instructions,
        leadCaptureEnabled: input.leadCaptureEnabled ?? current.leadCaptureEnabled,
        handoffNotificationsEnabled: input.handoffNotificationsEnabled ?? current.handoffNotificationsEnabled,
        knowledgeBaseId: input.knowledgeBaseId === undefined ? current.knowledgeBaseId : input.knowledgeBaseId,
        companyId: input.companyId === undefined ? current.companyId : input.companyId,
        collectName: input.collectName ?? current.collectName,
        collectEmail: input.collectEmail ?? current.collectEmail,
        collectPhone: input.collectPhone ?? current.collectPhone,
        accent: input.accent ?? current.accent,
        updatedAt: new Date(),
      })
      .where(eq(customerAiSettings.tenantId, actor.tenantId))
      .returning();
    return presentSettings(rows[0]);
  }

  private async captureLead(tenantId: string, state: typeof customerAiStates.$inferSelect) {
    const settings = await this.requireSettings(tenantId);
    const ready = leadReadiness({
      captureEnabled: settings.leadCaptureEnabled,
      companyId: settings.companyId,
      name: state.visitorName,
      email: state.visitorEmail,
      phone: state.visitorPhone,
    });
    if (!ready.ready || !settings.companyId || !state.visitorName) return { created: false, id: state.leadId, reason: ready.reason };
    if (state.leadId) return { created: false, id: state.leadId, reason: 'This conversation is already linked to a lead.' };
    const email = state.visitorEmail?.toLowerCase() ?? null;
    const existing = email
      ? await this.db.select({ id: leads.id }).from(leads).where(and(eq(leads.tenantId, tenantId), sql`lower(${leads.email}) = ${email}`)).limit(1)
      : await this.db.select({ id: leads.id }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.phone, state.visitorPhone ?? ''))).limit(1);
    if (existing[0]) {
      await this.db.update(customerAiStates).set({ leadId: existing[0].id, updatedAt: new Date() }).where(eq(customerAiStates.id, state.id));
      return { created: false, id: existing[0].id, reason: 'An existing lead with this contact was linked. A duplicate was not created.' };
    }
    const name = splitName(state.visitorName);
    let created: { id: string };
    try {
      created = await this.leads.create(tenantId, {
        companyId: settings.companyId,
        firstName: name.firstName,
        lastName: name.lastName ?? undefined,
        email: email ?? undefined,
        phone: state.visitorPhone ?? undefined,
        source: LEAD_SOURCE,
        notes: state.requirements ?? undefined,
      });
    } catch {
      return { created: false, id: null, reason: 'A lead was not created because the CRM did not accept these details.' };
    }
    await this.db.update(customerAiStates).set({ leadId: created.id, updatedAt: new Date() }).where(eq(customerAiStates.id, state.id));
    await this.audit(tenantId, null, 'customer.lead.created', created.id, 'A lead was created from a customer conversation.');
    await this.workflows.dispatchEvent(tenantId, 'customer_lead_created', `customer-lead:${created.id}`);
    return { created: true, id: created.id, reason: ready.reason };
  }

  private async lookup(tenantId: string, knowledgeBaseId: string | null, query: string) {
    if (!this.knowledge || !knowledgeBaseId) return [];
    try {
      const chunks = await this.knowledge.searchKnowledge(tenantId, query, 3, knowledgeBaseId);
      return excerptsFromChunks(chunks.map((chunk) => ({ documentTitle: chunk.documentName ?? undefined, content: chunk.content })));
    } catch {
      return [];
    }
  }

  private async narrate(tenantId: string, deterministic: string, source: string, instructions: string) {
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');
    if (!apiKey) return deterministic;
    try {
      const { GoogleGenAI } = require('@google/genai');
      const client = new GoogleGenAI({ apiKey });
      const model = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
      const request = () =>
        client.models.generateContent({
          model,
          contents: [
            'Rewrite the answer in plain sentences.',
            'Use only facts that already appear. Do not add prices, promises, names, or internal information.',
            instructions.trim() ? `Tone note from the business, which is not a fact source: ${instructions.trim().slice(0, 1000)}` : '',
            deterministic.slice(0, 3000),
          ].join('\n'),
          config: { temperature: 0 },
        });
      const response = await Promise.race([
        this.tracker
          ? this.tracker.observe({ tenantId, userId: null, agentName: 'customer-facing', provider: 'google', model }, request)
          : request(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('The rewrite took too long.')), 12_000)),
      ]);
      const text = typeof response?.text === 'function' ? response.text() : response?.text;
      return acceptGroundedRewrite(`${deterministic}\n${source}`, typeof text === 'string' ? text : null) ?? deterministic;
    } catch {
      return deterministic;
    }
  }

  private async refreshSummary(tenantId: string, conversationId: string) {
    const rows = await this.visibleMessages(tenantId, conversationId);
    return summarizeMessages(rows.map((row) => ({ role: row.role, content: row.content })));
  }

  private async visibleMessages(tenantId: string, conversationId: string) {
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
      .orderBy(messages.createdAt);
    return rows.filter((row) => row.role === 'human' || row.role === 'ai');
  }

  private async addMessage(tenantId: string, conversationId: string, role: string, content: string, userId?: string) {
    await this.db.insert(messages).values({ tenantId, conversationId, role, content, userId: userId ?? null, metadata: { audience: role === 'internal' ? 'staff' : 'customer' } });
  }

  private async settingsByKey(publicKey: string) {
    if (!isWellFormedPublicKey(publicKey)) throw new NotFoundException('This chat is not available.');
    const rows = await this.db.select().from(customerAiSettings).where(eq(customerAiSettings.publicKey, publicKey)).limit(1);
    if (!rows[0]) throw new NotFoundException('This chat is not available.');
    return rows[0];
  }

  private async requireSettings(tenantId: string) {
    const rows = await this.db.select().from(customerAiSettings).where(eq(customerAiSettings.tenantId, tenantId)).limit(1);
    if (!rows[0]) throw new NotFoundException('Customer AI settings were not found.');
    return rows[0];
  }

  private async ensureSettings(tenantId: string) {
    const existing = await this.db.select().from(customerAiSettings).where(eq(customerAiSettings.tenantId, tenantId)).limit(1);
    if (existing[0]) return presentSettings(existing[0]);
    const rows = await this.db
      .insert(customerAiSettings)
      .values({
        tenantId,
        publicKey: generatePublicKey(),
        displayName: 'Assistant',
        welcomeMessage: 'Hello. I can answer from this business’s published information.',
        instructions: '',
      })
      .returning();
    return presentSettings(rows[0]);
  }

  private async requireSession(token: string, publicKey: string) {
    if (!isWellFormedSessionToken(token)) throw new ForbiddenException('This chat session is not valid.');
    const settings = await this.settingsByKey(publicKey);
    const rows = await this.db.select().from(customerChatSessions).where(eq(customerChatSessions.tokenHash, hashSessionToken(token))).limit(1);
    if (!rows[0] || !sessionUsable(rows[0]) || rows[0].tenantId !== settings.tenantId) {
      throw new ForbiddenException('This chat session is not valid.');
    }
    return rows[0];
  }

  private async requireState(tenantId: string, conversationId: string) {
    const rows = await this.db
      .select()
      .from(customerAiStates)
      .where(and(eq(customerAiStates.tenantId, tenantId), eq(customerAiStates.conversationId, conversationId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Conversation not found.');
    return rows[0];
  }

  private async requireCompany(tenantId: string, companyId: string) {
    const rows = await this.db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId))).limit(1);
    if (!rows[0]) throw new BadRequestException('That company is not in this business.');
  }

  private async requireKnowledgeBase(tenantId: string, id: string) {
    const rows = await this.db.select({ id: knowledgebases.id }).from(knowledgebases).where(and(eq(knowledgebases.id, id), eq(knowledgebases.tenantId, tenantId))).limit(1);
    if (!rows[0]) throw new BadRequestException('That knowledge base is not in this business.');
  }

  private allow(actor: Actor, permission: (typeof Permission)[keyof typeof Permission]) {
    if (!hasPermission(actor.role, permission)) throw new ForbiddenException('You do not have permission for this action.');
  }

  private allowAny(actor: Actor, permissions: Array<(typeof Permission)[keyof typeof Permission]>) {
    if (!hasAnyPermission(actor.role, permissions)) throw new ForbiddenException('You do not have permission for this action.');
  }

  private async audit(tenantId: string, userId: string | null, action: string, entityId: string, description: string) {
    await this.db.insert(auditLogs).values({
      tenantId,
      userId,
      action,
      entityType: 'customer_conversation',
      entityId,
      description,
      metadata: {},
    });
  }
}

type SettingsInput = {
  enabled?: boolean;
  displayName?: string;
  welcomeMessage?: string;
  instructions?: string;
  leadCaptureEnabled?: boolean;
  handoffNotificationsEnabled?: boolean;
  knowledgeBaseId?: string | null;
  companyId?: string | null;
  collectName?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
  accent?: string;
};

function presentSettings(row: typeof customerAiSettings.$inferSelect) {
  return row;
}

function presentMessage(row: { id: string; role: string; content: string; createdAt: Date }) {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.createdAt };
}

function clean(value: string | undefined, max: number) {
  if (value === undefined) return undefined;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function clip(value: string | undefined, max: number) {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (text.length < 2) throw new BadRequestException('That value is too short.');
  return text.slice(0, max);
}
