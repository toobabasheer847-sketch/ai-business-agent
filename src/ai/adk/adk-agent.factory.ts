import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAdkModelName } from '../context/resolve-adk-model.js';
import { buildCommunicationAgent } from '../agents/communication/communication-agent.factory.js';
import { CommunicationToolsProvider } from '../agents/communication/communication-tools.provider.js';
import { TwilioToolsProvider } from '../agents/communication/twilio/twilio-tools.provider.js';
import { createMasterAgent } from '../agents/master/master.agent.js';
import { ProposalAgent } from '../agents/proposal/proposal-agent.js';
import { RagAgent } from '../agents/rag/rag.agent.js';
import { TaskAgent } from '../agents/task/task.agent.js';

@Injectable()
export class AdkAgentFactoryService {
  private readonly masterAgents = new Map<string, unknown>();
  private readonly ragAgents = new Map<string, unknown>();

  constructor(
    private readonly configService: ConfigService,
    private readonly communicationToolsProvider: CommunicationToolsProvider,
    private readonly twilioToolsProvider: TwilioToolsProvider,
    private readonly ragAgent: RagAgent,
    private readonly taskAgent: TaskAgent,
    private readonly proposalAgent: ProposalAgent,
  ) {}

  resolveModel(tenantAiModel?: string | null): string {
    return resolveAdkModelName(this.configService, tenantAiModel);
  }

  getMasterAgent(tenantAiModel?: string | null) {
    const modelName = this.resolveModel(tenantAiModel);
    const cached = this.masterAgents.get(modelName);
    if (cached) {
      return cached;
    }

    const communicationAgent = buildCommunicationAgent(
      this.communicationToolsProvider,
      this.twilioToolsProvider,
      { model: modelName },
    );

    // Every Master subagent must be a fresh ADK instance. Cached/shared children
    // (especially RAG) retain parentAgent and throw on the next RoutedAgent build.
    const agent = createMasterAgent({
      modelName,
      communicationAgent,
      ragAgent: this.ragAgent.isConfigured()
        ? this.ragAgent.buildLlmAgent(modelName)
        : undefined,
      taskAgent: this.taskAgent.buildLlmAgent(modelName) ?? undefined,
      proposalAgent: this.proposalAgent.buildLlmAgent(modelName) ?? undefined,
    });

    this.masterAgents.set(modelName, agent);
    return agent;
  }

  /**
   * Standalone RAG ADK agent for deterministic-fallback RAG queries.
   * Not used as a Master subagent — Master always builds its own fresh rag child.
   */
  getRagAgent(tenantAiModel?: string | null) {
    if (!this.ragAgent.isConfigured()) {
      return null;
    }

    const modelName = this.resolveModel(tenantAiModel);
    const cached = this.ragAgents.get(modelName);
    if (cached) {
      return cached;
    }

    const agent = this.ragAgent.buildLlmAgent(modelName);
    this.ragAgents.set(modelName, agent);
    return agent;
  }
}
