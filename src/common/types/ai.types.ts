export interface AgentContext {
  userId: string;
  tenantId: string;
  email?: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
