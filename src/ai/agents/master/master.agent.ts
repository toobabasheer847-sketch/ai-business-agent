import { FunctionTool, LlmAgent, RoutedAgent } from '@google/adk';
import { z } from 'zod';

const getSystemStatusTool = new FunctionTool({
  name: 'get_system_status',

  description:
    'Returns the current status of the AI Business Agent system.',

  parameters: z.object({}),

  execute: async () => {
    return {
      status: 'success',
      message: 'AI Business Agent system is running.',
    };
  },
});

function extractUserText(context: any): string {
  const content =
    context?.userContent ||
    context?.newMessage ||
    context?.request ||
    context?.message ||
    context?.content;

  if (!content) {
    return '';
  }

  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  if (typeof content.text === 'string' && content.text.trim()) {
    return content.text.trim();
  }

  if (Array.isArray(content.parts)) {
    return content.parts
      .map((part: any) => part?.text)
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  return '';
}

export function buildMasterRouter() {
  return async (agents: Record<string, any>, context: any) => {
    const userText = extractUserText(context).toLowerCase();

    const isSystemStatus = /\b(status|health|uptime|alive|running)\b/.test(userText) && /\b(system|service|platform|agent|application)\b/.test(userText);
    if (isSystemStatus && agents.master_status_agent) {
      return 'master_status_agent';
    }

    const routeToProposal = /\b(?:project proposal|business proposal|implementation proposal|scope and pricing|quotation|quote|estimate|bid|rfp|proposal content|generate proposal|send proposal|create proposal|write proposal|professional proposal|proposal for|proposal)\b/;
    const routeToTask = /\b(task|todo|deadline|due|assign|complete|cancel|remind|follow up|follow-up)\b/;
    const routeToCommunication = /\b(email|mail|draft|send|inbox|reply|compose|respond|outgoing|sms|call|phone)\b/;
    const routeToRag = /\b(search|knowledge|document|wiki|faq|information|what is|who is|how to|where|tell me about)\b/;

    if (routeToProposal.test(userText) && agents.proposal_agent) {
      return 'proposal_agent';
    }

    if (routeToTask.test(userText) && agents.task_agent) {
      return 'task_agent';
    }

    if (routeToCommunication.test(userText) && agents.communication_agent) {
      return 'communication_agent';
    }

    if (routeToRag.test(userText) && agents.rag_agent) {
      return 'rag_agent';
    }

    if (userText.length === 0) {
      return 'master_status_agent';
    }

    if (agents.communication_agent) {
      return 'communication_agent';
    }

    if (agents.rag_agent) {
      return 'rag_agent';
    }

    if (agents.task_agent) {
      return 'task_agent';
    }

    if (agents.proposal_agent) {
      return 'proposal_agent';
    }

    return 'master_status_agent';
  };
}

export function createMasterAgent(options: {
  communicationAgent?: any;
  ragAgent?: any;
  taskAgent?: any;
  proposalAgent?: any;
}) {
  const availableAgents: any[] = [];

  const statusAgent = new LlmAgent({
    name: 'master_status_agent',
    model: 'gemini-3.6-flash',
    instruction: `You are the Master Agent status responder. Answer system health and status requests clearly and use the provided system status tool when appropriate.`,
    tools: [getSystemStatusTool],
  });

  availableAgents.push(statusAgent);

  if (options.communicationAgent) {
    availableAgents.push(options.communicationAgent);
  }

  if (options.ragAgent) {
    availableAgents.push(options.ragAgent);
  }

  if (options.taskAgent) {
    availableAgents.push(options.taskAgent);
  }

  if (options.proposalAgent) {
    availableAgents.push(options.proposalAgent);
  }

  return new RoutedAgent({
    name: 'master_agent',
    description: 'Main orchestration agent for the AI Business Agent system.',
    agents: availableAgents,
    router: buildMasterRouter(),
  });
}
