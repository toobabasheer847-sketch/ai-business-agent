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
    return resolveMasterRoute(extractUserText(context), agents);
  };
}

export function isConversationalMessage(userTextInput: string): boolean {
  const text = userTextInput.trim().toLowerCase();
  if (!text) {
    return false;
  }

  const knowledgeIntentPattern =
    /\b(what|who|where|when|why|how|which|tell me about|explain|describe|summarize|search|find|lookup|according|uploaded|document|documents|knowledge|wiki|faq|policy|refund|contain|contains|pdf|profile|skill|skills|experience|project|projects)\b/;

  if (knowledgeIntentPattern.test(text)) {
    return false;
  }

  const conversationalPattern =
    /^(?:hi|hello|hey|hiya|howdy|greetings|yo|sup|good morning|good afternoon|good evening|good night)(?:[!?.,…\s]|$)|^how are you\b|^how(?:'s| is) it going\b|^(?:thanks|thank you|thx|ty)(?:[!?.,…\s]|$)|^(?:bye|goodbye|see you|talk soon)(?:[!?.,…\s]|$)|^(?:ok|okay|cool|great|nice|got it|understood)(?:[!?.,…\s]|$)/;

  return conversationalPattern.test(text);
}

export async function resolveMasterRoute(
  userTextInput: string,
  agents: Record<string, any>,
): Promise<string> {
  const userText = userTextInput.toLowerCase();

  const isSystemStatus =
    /\b(status|health|uptime|alive|running)\b/.test(userText) &&
    /\b(system|service|platform|agent|application)\b/.test(userText);
  if (isSystemStatus && agents.master_status_agent) {
    return 'master_status_agent';
  }

  const routeToProposal =
    /\b(?:project proposal|business proposal|implementation proposal|scope and pricing|quotation|quote|estimate|bid|rfp|proposal content|generate proposal|send proposal|create proposal|write proposal|professional proposal|proposal for|proposal)\b/;
  const routeToTask =
    /\b(tasks|task|todo|deadline|due|assign|complete|cancel|remind|follow up|follow-up|overdue|statistics|analytics)\b/;
  const routeToCommunication =
    /\b(email|mail|draft|send|inbox|reply|compose|respond|outgoing|sms|call|phone)\b/;
  const routeToRag =
    /\b(search|knowledge|document|wiki|faq|information|what is|who is|how to|where|tell me about|uploaded|contain|contains|pdf|explain|describe|summarize|find|lookup|according|content|answer|policy|refund)\b/;

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

  if (isConversationalMessage(userTextInput) && agents.master_chat_agent) {
    return 'master_chat_agent';
  }

  if (agents.master_chat_agent) {
    return 'master_chat_agent';
  }

  if (agents.communication_agent) {
    return 'communication_agent';
  }

  if (agents.task_agent) {
    return 'task_agent';
  }

  if (agents.proposal_agent) {
    return 'proposal_agent';
  }

  return 'master_status_agent';
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

  const chatAgent = new LlmAgent({
    name: 'master_chat_agent',
    model: 'gemini-3.6-flash',
    instruction: `You are a friendly AI business assistant. Handle greetings and casual conversation naturally with brief, professional replies. Do not mention knowledge bases, uploaded documents, profiles, skills, experience, projects, or retrieved context unless the user explicitly asks a knowledge-related question.`,
    tools: [],
  });

  availableAgents.push(statusAgent);
  availableAgents.push(chatAgent);

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
