import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InMemoryRunner } from '@google/adk';

import { createMasterAgent, resolveMasterRoute } from './master.agent.js';
import { CommunicationAgentService } from '../communication/communication.service.js';
import { RagAgent } from '../rag/rag.agent.js';
import { RagSourceMetadata } from '../rag/types/rag.types.js';
import { TaskAgent } from '../task/task.agent.js';
import { ProposalAgent } from '../proposal/proposal-agent.js';

const AGENT_DELEGATION_LABELS: Record<string, string> = {
  proposal_agent: 'proposal',
  task_agent: 'task',
  communication_agent: 'communication',
  rag_agent: 'rag',
  master_status_agent: 'status',
  master_chat_agent: 'chat',
};

export type MasterChatResponse = {
  response: string;
  delegation: string | null;
  sources?: RagSourceMetadata[];
  usedKnowledge?: boolean;
  message?: string;
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
    private readonly proposalAgent: ProposalAgent,
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
      task_agent: taskAgentInstance ?? undefined,
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

  async invoke(tenantId: string, message: string): Promise<MasterChatResponse> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Message is required');
    }

    const routeTarget = await resolveMasterRoute(
      trimmedMessage,
      this.routeAgents,
    );

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
          parts: [{ text: trimmedMessage }],
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
