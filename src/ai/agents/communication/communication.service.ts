import { Injectable, OnModuleInit } from '@nestjs/common';
import { LlmAgent } from '@google/adk';

import { CommunicationToolsProvider } from './communication-tools.provider';
import { TwilioToolsProvider } from './twilio/twilio-tools.provider';
import { buildCommunicationAgent } from './communication-agent.factory';

@Injectable()
export class CommunicationAgentService implements OnModuleInit {
  private agent: LlmAgent | null = null;

  constructor(
    private readonly toolsProvider: CommunicationToolsProvider,
    private readonly twilioToolsProvider: TwilioToolsProvider,
  ) {}

  onModuleInit(): void {
    this.agent = buildCommunicationAgent(
      this.toolsProvider,
      this.twilioToolsProvider,
    );
  }

  getAgent(): LlmAgent {
    if (!this.agent) {
      this.agent = buildCommunicationAgent(
        this.toolsProvider,
        this.twilioToolsProvider,
      );
    }
    return this.agent;
  }

  get name(): string {
    return this.getAgent().name;
  }
}
