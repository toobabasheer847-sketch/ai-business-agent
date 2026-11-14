import { InMemoryRunner } from '@google/adk';

export type AdkEphemeralEvent = {
  author?: string;
  branch?: string;
  content?: { parts?: Array<{ text?: string }> };
};

export type AdkEphemeralResult = {
  finalText: string;
  authors: string[];
  branches: string[];
  lastToolResult?: unknown;
};

export async function runAdkEphemeral(options: {
  appName: string;
  agent: unknown;
  userId: string;
  message: string;
}): Promise<AdkEphemeralResult> {
  const runner = new InMemoryRunner({
    appName: options.appName,
    agent: options.agent as any,
  });

  let finalText = '';
  const branches = new Set<string>();
  const authors = new Set<string>();
  let lastToolResult: unknown;

  for await (const event of runner.runEphemeral({
    userId: options.userId,
    newMessage: {
      parts: [{ text: options.message }],
    },
  })) {
    if (event.branch) {
      branches.add(event.branch);
    }

    if (event.author) {
      authors.add(event.author);
    }

    if (event.content?.parts?.length) {
      for (const part of event.content.parts as Array<any>) {
        if (part?.functionResponse?.response !== undefined) {
          lastToolResult = part.functionResponse.response;
        }
      }

      const text = event.content.parts
        .filter((part) => part?.text)
        .map((part) => part.text)
        .join('');

      if (text.trim()) {
        finalText = text;
      }
    }
  }

  return {
    finalText,
    authors: [...authors],
    branches: [...branches],
    lastToolResult,
  };
}
