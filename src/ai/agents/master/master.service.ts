import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryRunner } from '@google/adk';

import {
  DEFAULT_AI_CHAT_HISTORY_LIMIT,
  MAX_AI_CHAT_HISTORY_LIMIT,
  resolveChatHistoryLimit,
} from '../../../config/ai.config';
import {
  ASSISTANT_CONVERSATION_CHANNEL,
  ConversationRepository,
} from '../../../modules/conversation/conversation.repository';
import { createMasterAgent, resolveMasterRoute } from './master.agent.js';
import { CommunicationAgentService } from '../communication/communication.service.js';
import { RagAgent } from '../rag/rag.agent.js';
import { RagSourceMetadata } from '../rag/types/rag.types.js';
import { TaskAgent } from '../task/task.agent.js';
import { TaskService } from '../task/task.service.js';
import {
  TaskAgentResponse,
  TaskRecord,
} from '../task/types/task.types.js';
import { ProposalAgent } from '../proposal/proposal-agent.js';

const AGENT_DELEGATION_LABELS: Record<string, string> = {
  proposal_agent: 'proposal',
  task_agent: 'task',
  communication_agent: 'communication',
  rag_agent: 'rag',
  master_status_agent: 'status',
  master_chat_agent: 'chat',
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
};

type HistoryMessage = {
  role: string;
  content: string;
};

@Injectable()
export class MasterAgentService {
  private readonly logger = new Logger(MasterAgentService.name);
  private readonly masterAgent: any;
  private readonly routeAgents: Record<string, unknown>;

  constructor(
    private readonly communicationAgentService: CommunicationAgentService,
    private readonly ragAgent: RagAgent,
    private readonly taskAgent: TaskAgent,
    private readonly taskService: TaskService,
    private readonly proposalAgent: ProposalAgent,
    private readonly conversationRepository: ConversationRepository,
    private readonly configService: ConfigService,
  ) {
    const communicationAgent = this.communicationAgentService.getAgent();
    const ragAgentInstance = this.ragAgent.getAgentInstance?.();
    const taskAgentInstance = this.taskAgent.getAgentInstance?.();
    const proposalAgentInstance = this.proposalAgent.getAgentInstance?.();

    const missingAgents: string[] = [];
    if (!communicationAgent) missingAgents.push('communication_agent');
    if (!ragAgentInstance) missingAgents.push('rag_agent');
    if (!taskAgentInstance) missingAgents.push('task_agent');
    if (!proposalAgentInstance) missingAgents.push('proposal_agent');

    if (missingAgents.length) {
      this.logger.warn(
        `MasterAgent is starting without the following specialized agents: ${missingAgents.join(', ')}`,
      );
    }

    this.routeAgents = {
      master_status_agent: {},
      master_chat_agent: {},
      communication_agent: communicationAgent ?? undefined,
      rag_agent: ragAgentInstance ?? undefined,
      // Always present so task intents route to TaskService even without Gemini/ADK.
      task_agent: taskAgentInstance ?? { name: 'task_agent' },
      proposal_agent: proposalAgentInstance ?? undefined,
    };

    this.masterAgent = createMasterAgent({
      communicationAgent,
      ragAgent: ragAgentInstance,
      taskAgent: taskAgentInstance,
      proposalAgent: proposalAgentInstance,
    });
  }

  getAgent() {
    return this.masterAgent;
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

    const aiResult = await this.executeExistingAi(
      tenantId,
      userId,
      trimmedMessage,
      history,
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

  private async executeExistingAi(
    tenantId: string,
    userId: string,
    trimmedMessage: string,
    history: HistoryMessage[],
  ): Promise<MasterChatResponse> {
    const routeTarget = await resolveMasterRoute(
      trimmedMessage,
      this.routeAgents,
    );

    if (routeTarget === 'task_agent') {
      try {
        const taskResult = await this.taskService.processNaturalLanguage(
          trimmedMessage,
          { tenantId, userId },
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
        const ragResult = await this.ragAgent.answerQuery(
          tenantId,
          trimmedMessage,
        );

        return {
          response: ragResult.answer,
          delegation: 'rag',
          sources: ragResult.sources,
          usedKnowledge: ragResult.usedKnowledge,
          message: ragResult.message,
        };
      } catch (error) {
        this.logger.error('RAG delegation failed', error as Error);
        throw new InternalServerErrorException(
          'Knowledge retrieval failed to process the request',
        );
      }
    }

    const modelInput = this.formatHistoryForModel(history, trimmedMessage);
    const runner = new InMemoryRunner({
      appName: 'master-agent',
      agent: this.masterAgent,
    });

    let finalText = '';
    const branches = new Set<string>();
    const authors = new Set<string>();

    try {
      for await (const event of runner.runEphemeral({
        userId: tenantId,
        newMessage: {
          parts: [{ text: modelInput }],
        },
      })) {
        if (event.branch) {
          branches.add(event.branch);
        }

        if (event.author) {
          authors.add(event.author);
        }

        if (event.content?.parts?.length) {
          const text = event.content.parts
            .filter((part: any) => part?.text)
            .map((part: any) => part.text)
            .join('');

          if (text.trim()) {
            finalText = text;
          }
        }
      }
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

    if (!result.data || Array.isArray(result.data)) {
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

    return result.message || summary;
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
