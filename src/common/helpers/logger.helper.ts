export interface LoggerContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
}

export const createLogContext = (context: LoggerContext) => ({
  ...(context.tenantId ? { tenantId: context.tenantId } : {}),
  ...(context.userId ? { userId: context.userId } : {}),
  ...(context.requestId ? { requestId: context.requestId } : {}),
});
