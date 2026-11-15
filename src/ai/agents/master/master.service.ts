import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { runAdkEphemeral } from '../../adk/run-adk-ephemeral.js';
import { AdkAgentFactoryService } from '../../adk/adk-agent.factory.js';
import { assertRolePermission } from '../../context/assert-ai-permission.js';
import { getTrustedAiContext, runWithAiContext } from '../../context/ai-request-context.js';
import { hasPermission, Permission } from '../../../modules/authorization/permissions';

import {
  DEFAULT_AI_CHAT_HISTORY_LIMIT,
  MAX_AI_CHAT_HISTORY_LIMIT,
  resolveChatHistoryLimit,
} from '../../../config/ai.config';
import {
  ASSISTANT_CONVERSATION_CHANNEL,
  ConversationRepository,
} from '../../../modules/conversation/conversation.repository';
import { MasterSettingsService } from '../../../modules/master-settings/master-settings.service';
import { resolveMasterRoute } from './master.agent.js';
import { CommunicationAgentService } from '../communication/communication.service.js';
import { RagAgent } from '../rag/rag.agent.js';
import { RagSourceMetadata } from '../rag/types/rag.types.js';
import { TaskAgent } from '../task/task.agent.js';
import {
  TaskAgentResponse,
  TaskRecord,
} from '../task/types/task.types.js';
import { ProposalAgent } from '../proposal/proposal-agent.js';
import { TeamAgent } from '../team/team-agent.js';
import type { PlannedOperation } from './orchestrator/intent-plan.js';
import {
  MasterOrchestratorService,
  type OrchestrationPayload,
} from './orchestrator/orchestrator.service.js';

const AGENT_DELEGATION_LABELS: Record<string, string> = {
  proposal_agent: 'proposal',
  task_agent: 'task',
  communication_agent: 'communication',
  rag_agent: 'rag',
  master_status_agent: 'status',
  master_chat_agent: 'chat',
  team_agent: 'team',
};

const ASSISTANT_THREAD_LIST_LIMIT = 20;
const ASSISTANT_THREAD_MESSAGE_CAP = 200;

export type MasterChatResponse = {
  conversationId?: string;
  response: string;
  delegation: string | null;
  sources?: RagSourceMetadata[];
  usedKnowledge?: boolean;
  message?: string;
  orchestration?: OrchestrationPayload;
};

type HistoryMessage = {
  role: string;
  content: string;
};

@Injectable()
export class MasterAgentService {
  private readonly logger = new Logger(MasterAgentService.name);
  private readonly routeAgents: Record<string, unknown>;

  constructor(
    private readonly communicationAgentService: CommunicationAgentService,
    private readonly ragAgent: RagAgent,
    private readonly taskAgent: TaskAgent,
    private readonly proposalAgent: ProposalAgent,
    private readonly conversationRepository: ConversationRepository,
    private readonly configService: ConfigService,
    private readonly masterSettingsService: MasterSettingsService,
    private readonly adkAgentFactory: AdkAgentFactoryService,
    @Optional() private readonly teamAgent?: TeamAgent,
    @Optional() private readonly orchestrator?: MasterOrchestratorService,
  ) {
    const communicationAgent = this.communicationAgentService.getAgent();
    const hasGemini = !!this.configService.get<string>('GOOGLE_GENAI_API_KEY');

    const missingAgents: string[] = [];
    if (!communicationAgent) missingAgents.push('communication_agent');
    if (!hasGemini) missingAgents.push('rag_agent');

    if (missingAgents.length) {
      this.logger.warn(
        `MasterAgent is starting without the following specialized agents: ${missingAgents.join(', ')}`,
      );
    }

    if (!hasGemini) {
      this.logger.warn(
        'GOOGLE_GENAI_API_KEY is not configured — LLM-backed proposal and RAG routes use deterministic fallbacks where available.',
      );
    }

    // Routing placeholders only — ADK hierarchy is built once per model in AdkAgentFactory.
    this.routeAgents = {
      master_status_agent: { name: 'master_status_agent' },
      master_chat_agent: { name: 'master_chat_agent' },
      communication_agent: communicationAgent
        ? { name: 'communication_agent' }
        : undefined,
      rag_agent: hasGemini ? { name: 'rag_agent' } : undefined,
      task_agent: { name: 'task_agent' },
      proposal_agent: { name: 'proposal_agent' },
      team_agent: this.teamAgent ? { name: 'team_agent' } : undefined,
    };
  }

  getAgent(): { name: string } {
    // Status probe only — do not construct/cache a Master hierarchy here.
    // Chat builds the tenant-model Master via getMasterAgent(aiModel).
    return { name: 'master_agent' };
  }

  getChatHistoryLimit(): number {
    return resolveChatHistoryLimit(
      this.configService.get<number | string>('AI_CHAT_HISTORY_LIMIT') ??
        DEFAULT_AI_CHAT_HISTORY_LIMIT,
    );
  }

  async invoke(
    tenantId: string,
    userId: string,
    message: string,
    conversationId?: string,
    role?: string,
  ): Promise<MasterChatResponse> {
    if (!tenantId || !userId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Message is required');
    }

    const conversation = await this.resolveConversation(
      tenantId,
      userId,
      trimmedMessage,
      conversationId,
    );

    const historyLimit = this.getChatHistoryLimit();
    const history = await this.conversationRepository.findRecentMessages(
      conversation.id,
      tenantId,
      historyLimit,
    );

    await this.persistUserMessage(
      tenantId,
      userId,
      conversation.id,
      trimmedMessage,
    );

    const settings = await this.masterSettingsService.getOrCreate(tenantId);

    const aiResult = await runWithAiContext(
      { tenantId, userId, role, aiModel: settings.aiModel },
      () =>
        this.dispatchAi(tenantId, userId, trimmedMessage, history, conversation.id, role),
    );

    await this.persistAssistantMessage(tenantId, conversation.id, aiResult);

    return {
      conversationId: conversation.id,
      ...aiResult,
    };
  }

  async listAssistantConversations(tenantId: string, userId: string) {
    if (!tenantId || !userId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.conversationRepository.findRecentByUser(
      tenantId,
      userId,
      ASSISTANT_THREAD_LIST_LIMIT,
    );
  }

  async getAssistantConversationMessages(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    await this.requireOwnedAssistantConversation(
      tenantId,
      userId,
      conversationId,
    );

    return this.conversationRepository.findRecentMessages(
      conversationId,
      tenantId,
      ASSISTANT_THREAD_MESSAGE_CAP,
    );
  }

  async deleteAssistantConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    await this.requireOwnedAssistantConversation(
      tenantId,
      userId,
      conversationId,
    );

    const deleted = await this.conversationRepository.deleteByIdTenantAndUser(
      conversationId,
      tenantId,
      userId,
    );

    if (!deleted) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private async requireOwnedAssistantConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    if (!tenantId || !userId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const conversation =
      await this.conversationRepository.findByIdTenantAndUser(
        conversationId,
        tenantId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private async resolveConversation(
    tenantId: string,
    userId: string,
    message: string,
    conversationId?: string,
  ) {
    if (conversationId) {
      const existing = await this.conversationRepository.findByIdTenantAndUser(
        conversationId,
        tenantId,
        userId,
      );

      if (!existing) {
        throw new NotFoundException('Conversation not found');
      }

      return existing;
    }

    try {
      return await this.conversationRepository.create({
        tenantId,
        userId,
        title: this.buildConversationTitle(message),
        channel: ASSISTANT_CONVERSATION_CHANNEL,
      });
    } catch (error) {
      this.logger.error(
        'Failed to create assistant conversation',
        error as Error,
      );
      throw new InternalServerErrorException(
        'Failed to create assistant conversation',
      );
    }
  }

  private async persistUserMessage(
    tenantId: string,
    userId: string,
    conversationId: string,
    content: string,
  ) {
    try {
      await this.conversationRepository.createMessage({
        tenantId,
        conversationId,
        userId,
        role: 'user',
        content,
      });
      await this.conversationRepository.touchUpdatedAt(conversationId, tenantId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to persist user message for conversation ${conversationId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Failed to persist chat message');
    }
  }

  private async persistAssistantMessage(
    tenantId: string,
    conversationId: string,
    result: MasterChatResponse,
  ) {
    try {
      await this.conversationRepository.createMessage({
        tenantId,
        conversationId,
        role: 'assistant',
        content: result.response,
        metadata: this.buildAssistantMetadata(result),
      });
      await this.conversationRepository.touchUpdatedAt(conversationId, tenantId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to persist assistant message for conversation ${conversationId}`,
        error as Error,
      );
      throw new InternalServerErrorException(
        'Failed to persist assistant response',
      );
    }
  }

  async confirmOrchestration(
    tenantId: string,
    userId: string,
    conversationId: string,
    orchestrationId: string,
    role?: string,
  ): Promise<MasterChatResponse> {
    await this.requireOwnedAssistantConversation(tenantId, userId, conversationId);
    if (!this.orchestrator) {
      throw new InternalServerErrorException('Orchestrator is unavailable');
    }

    const messages = await this.conversationRepository.findMessagesByConversation(
      conversationId,
      tenantId,
    );
    const stored = [...messages].reverse().find((message) => {
      const metadata = message.metadata as { orchestration?: OrchestrationPayload } | null;
      return metadata?.orchestration?.id === orchestrationId;
    });
    const orchestration = (stored?.metadata as { orchestration?: OrchestrationPayload } | null)?.orchestration;
    if (!orchestration) {
      throw new NotFoundException('Orchestration not found');
    }

    const pending = orchestration.operations.filter((operation) => operation.status === 'awaiting_confirmation');
    if (!pending.length) {
      throw new BadRequestException('Nothing is waiting for confirmation.');
    }

    const confirmed: PlannedOperation[] = [];
    for (const operation of pending) {
      const planned: PlannedOperation = {
        operationId: operation.operationId,
        intent: operation.action as PlannedOperation['intent'],
        selectedAgent: operation.agent as PlannedOperation['selectedAgent'],
        action: operation.action as PlannedOperation['action'],
        requiredInputs: operation.outputs?.recordId ? { recordId: operation.outputs.recordId } : {},
        dependencies: [],
        executionMode: 'sequential',
        permissionRequirements: ['authenticated-tenant'],
        status: 'awaiting_confirmation',
        missing: [],
        sensitive: true,
        outputs: operation.outputs,
        entityId: operation.entityId,
      };
      confirmed.push(await this.orchestrator.confirm({
        tenantId,
        userId,
        role,
        operation: planned,
      }));
    }

    const operations = orchestration.operations.map((operation) => {
      const next = confirmed.find((item) => item.operationId === operation.operationId);
      return next
        ? { ...operation, status: next.status, summary: next.summary, entityId: next.entityId }
        : operation;
    });
    const response = confirmed.map((operation) => operation.summary ?? operation.action).join('\n');
    const result: MasterChatResponse = {
      response,
      delegation: 'orchestrator',
      orchestration: { ...orchestration, status: 'completed', operations },
    };
    await this.persistAssistantMessage(tenantId, conversationId, result);
    return { conversationId, ...result };
  }

  private async dispatchAi(
    tenantId: string,
    userId: string,
    trimmedMessage: string,
    history: HistoryMessage[],
    conversationId: string,
    role?: string,
  ): Promise<MasterChatResponse> {
    if (this.orchestrator?.shouldOrchestrate(trimmedMessage)) {
      return this.orchestrator.run({
        tenantId,
        userId,
        message: trimmedMessage,
        conversationId,
        role,
      });
    }

    return this.executeExistingAi(tenantId, userId, trimmedMessage, history, role);
  }

  private async executeExistingAi(
    tenantId: string,
    userId: string,
    trimmedMessage: string,
    history: HistoryMessage[],
    role?: string,
  ): Promise<MasterChatResponse> {
    const routeTarget = await resolveMasterRoute(
      trimmedMessage,
      this.routeAgents,
    );

    if (routeTarget === 'team_agent' && this.teamAgent) {
      try {
        assertRolePermission(role, [Permission.TeamInsightsView, Permission.TeamInsightsViewOwn]);
        const scopeUserId = hasPermission(role, Permission.TeamInsightsView) ? undefined : userId;
        const teamResult = await this.teamAgent.answer(tenantId, trimmedMessage, scopeUserId);
        return {
          response: teamResult.summary,
          delegation: 'team',
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        this.logger.error('Team delegation failed', error as Error);
        throw new InternalServerErrorException('Team request failed to process');
      }
    }

    if (routeTarget === 'task_agent') {
      try {
        const taskResult = await this.taskAgent.delegateNaturalLanguage(
          trimmedMessage,
          { tenantId, userId, ...(role ? { role } : {}) },
        );

        return {
          response: this.formatTaskAssistantResponse(taskResult),
          delegation: 'task',
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        this.logger.error('Task delegation failed', error as Error);
        throw new InternalServerErrorException(
          'Task request failed to process',
        );
      }
    }

    if (routeTarget === 'rag_agent' && this.routeAgents.rag_agent) {
      try {
        assertRolePermission(role, [Permission.KnowledgeManage]);
        const { aiModel } = getTrustedAiContext();
        const ragAgentInstance = this.adkAgentFactory.getRagAgent(
          aiModel,
        ) as any;

        if (!ragAgentInstance) {
          return {
            response:
              'Knowledge search is unavailable because the AI provider is not configured.',
            delegation: 'rag',
            sources: [],
            usedKnowledge: false,
            message: 'GOOGLE_GENAI_API_KEY is not configured',
          };
        }

        const ragResult = await this.ragAgent.delegateAdkQuery(
          tenantId,
          userId,
          trimmedMessage,
          ragAgentInstance,
        );

        return {
          response: ragResult.answer,
          delegation: 'rag',
          sources: ragResult.sources,
          usedKnowledge: ragResult.usedKnowledge,
          message: ragResult.message,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        this.logger.error('RAG delegation failed', error as Error);
        throw new InternalServerErrorException(
          'Knowledge retrieval failed to process the request',
        );
      }
    }

    if (routeTarget === 'proposal_agent') {
      try {
        const proposalResult = await this.proposalAgent.processRequest(
          { tenantId, userId, ...(role ? { role } : {}) },
          trimmedMessage,
        );

        return {
          response:
            proposalResult.message?.trim() ||
            'I could not complete the proposal request. Please try again.',
          delegation: 'proposal',
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        this.logger.error('Proposal delegation failed', error as Error);
        throw new InternalServerErrorException(
          'Proposal request failed to process',
        );
      }
    }

    const modelInput = this.formatHistoryForModel(history, trimmedMessage);
    const { aiModel } = getTrustedAiContext();
    const masterAgent = this.adkAgentFactory.getMasterAgent(aiModel);

    let finalText = '';
    const branches = new Set<string>();
    const authors = new Set<string>();

    try {
      const adkResult = await runAdkEphemeral({
        appName: 'master-agent',
        agent: masterAgent,
        userId,
        message: modelInput,
      });
      finalText = adkResult.finalText || this.formatEmptyAdkResponse(
        adkResult.lastToolResult,
        trimmedMessage,
      );
      adkResult.authors.forEach((author) => authors.add(author));
      adkResult.branches.forEach((branch) => branches.add(branch));
    } catch (error) {
      this.logger.error('MasterAgent invoke error', error as Error);
      throw new InternalServerErrorException(
        'Master Agent failed to process the request',
      );
    }

    return {
      response: finalText,
      delegation: this.resolveDelegation([...authors], [...branches]),
    };
  }

  private formatEmptyAdkResponse(
    toolResult: unknown,
    request: string,
  ): string {
    if (toolResult && typeof toolResult === 'object') {
      const wrappedResult = toolResult as { result?: unknown };
      const result = (wrappedResult.result ?? toolResult) as {
        message?: unknown;
        data?: { recipient?: unknown; status?: unknown };
      };
      if (typeof result.message === 'string' && result.message.trim()) {
        return result.message;
      }
      if (
        result.data?.status === 'sent' &&
        typeof result.data.recipient === 'string'
      ) {
        return `Proposal sent successfully to ${result.data.recipient}`;
      }
    }

    if (/proposal/i.test(request)) {
      return 'I could not complete the proposal request. Please try again.';
    }
    return 'I could not complete that request. Please try again.';
  }

  private formatHistoryForModel(
    history: HistoryMessage[],
    currentMessage: string,
  ): string {
    if (!history.length) {
      return currentMessage;
    }

    const bounded = history.slice(-MAX_AI_CHAT_HISTORY_LIMIT);
    const lines = bounded.map((item) => {
      const label =
        item.role === 'assistant' || item.role === 'ai'
          ? 'Assistant'
          : 'User';
      return `${label}: ${item.content}`;
    });

    return `Previous conversation:\n${lines.join('\n')}\n\nCurrent message:\n${currentMessage}`;
  }

  private buildAssistantMetadata(result: MasterChatResponse) {
    const metadata: Record<string, unknown> = {};

    if (result.delegation != null) {
      metadata.delegation = result.delegation;
    }

    if (result.sources) {
      metadata.sources = result.sources;
    }

    if (typeof result.usedKnowledge === 'boolean') {
      metadata.usedKnowledge = result.usedKnowledge;
    }

    if (result.message) {
      metadata.message = result.message;
    }

    if (result.orchestration) {
      metadata.orchestration = result.orchestration;
    }

    return metadata;
  }

  private buildConversationTitle(message: string): string {
    const compact = message.replace(/\s+/g, ' ').trim();
    if (compact.length <= 80) {
      return compact;
    }

    return `${compact.slice(0, 77)}...`;
  }

  private formatTaskAssistantResponse(result: TaskAgentResponse): string {
    if (result.action === 'clarify') {
      const matches = Array.isArray(result.data) ? result.data : [];
      if (matches.length > 0) {
        const lines = matches.map((task, index) =>
          this.formatTaskSummary(task, index + 1),
        );
        return `${result.message ?? 'Which task do you mean?'}\n${lines.join('\n')}`;
      }

      return result.message || 'Which task do you mean?';
    }

    if (result.action === 'list') {
      const tasks = Array.isArray(result.data) ? result.data : [];
      if (tasks.length === 0) {
        return 'You have no matching tasks.';
      }

      const lines = tasks.map((task, index) =>
        this.formatTaskSummary(task, index + 1),
      );
      return `${result.message || 'Here are your tasks:'}\n${lines.join('\n')}`;
    }

    if (result.action === 'analytics') {
      return result.message || 'Here are your task statistics.';
    }

    if (!result.data || Array.isArray(result.data) || !this.isTaskRecord(result.data)) {
      return result.message || 'Task not found.';
    }

    const summary = this.formatTaskSummary(result.data);

    if (result.action === 'create') {
      return `Task created successfully. ${summary}`;
    }
    if (result.action === 'complete') {
      return `Task completed. ${summary}`;
    }
    if (result.action === 'cancel') {
      return `Task cancelled. ${summary}`;
    }
    if (result.action === 'update') {
      return `Task updated. ${summary}`;
    }
    if (result.action === 'get') {
      return summary;
    }
    if (result.action === 'activity') {
      return result.message || summary;
    }
    if (
      result.action === 'reminder_list' ||
      result.action === 'reminder_enable' ||
      result.action === 'reminder_disable' ||
      result.action === 'reminder_reschedule'
    ) {
      return result.message || summary;
    }

    return result.message || summary;
  }

  private isTaskRecord(value: TaskAgentResponse['data']): value is TaskRecord {
    return Boolean(
      value &&
        !Array.isArray(value) &&
        'title' in value &&
        'status' in value,
    );
  }

  private formatTaskSummary(task: TaskRecord, index?: number): string {
    const parts = [`"${task.title}"`];

    if (task.priority) {
      parts.push(`priority ${task.priority}`);
    }
    if (task.status) {
      parts.push(`status ${task.status}`);
    }

    if (task.company?.name) {
      parts.push(`company ${task.company.name}`);
    }
    if (task.prospect?.name) {
      parts.push(`prospect ${task.prospect.name}`);
    }
    if (task.lead?.name) {
      parts.push(`lead ${task.lead.name}`);
    }

    const due = this.formatDueAt(task.dueAt);
    if (due) {
      parts.push(`due ${due}`);
    }

    const body = parts.join(', ');
    return index != null ? `${index}. ${body}` : body;
  }

  private formatDueAt(dueAt?: Date | string | null): string | undefined {
    if (!dueAt) {
      return undefined;
    }

    const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
      return date.toISOString().slice(0, 10);
    }

    return date.toISOString();
  }

  private resolveDelegation(
    authors: string[],
    branches: string[],
  ): string | null {
    const candidates = [...authors, ...branches];

    for (const candidate of candidates) {
      const mapped = AGENT_DELEGATION_LABELS[candidate];
      if (mapped) {
        return mapped;
      }
    }

    return null;
  }
}
