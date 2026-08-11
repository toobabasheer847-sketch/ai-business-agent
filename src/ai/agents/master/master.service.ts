import { Injectable, Logger } from '@nestjs/common';
import { InMemoryRunner } from '@google/adk';

import { createMasterAgent } from './master.agent.js';
import { CommunicationAgentService } from '../communication/communication.service.js';
import { RagAgent } from '../rag/rag.agent.js';
import { TaskAgent } from '../task/task.agent.js';
import { ProposalAgent } from '../proposal/proposal-agent.js';

@Injectable()
export class MasterAgentService {
  private readonly logger = new Logger(MasterAgentService.name);
  private readonly masterAgent: any;

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

  async invoke(agent: any, tenantId: string, message: string) {
    const runner = new InMemoryRunner({
      appName: 'master-agent',
      agent,
    });

    const events: any[] = [];
    let finalText = '';
    const branches = new Set<string>();
    const authors = new Set<string>();

    try {
      for await (const event of runner.runEphemeral({
        userId: tenantId,
        newMessage: {
          parts: [{ text: message }],
        },
      })) {
        events.push(event);

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
      finalText = `Master Agent failed to process the request: ${
        error instanceof Error ? error.message : 'unknown error'
      }`;
    }

    return {
      response: finalText,
      delegation: {
        branches: [...branches],
        authors: [...authors],
      },
      events,
    };
  }
}