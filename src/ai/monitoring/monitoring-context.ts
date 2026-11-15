import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type MonitoringContext = {
  tenantId: string;
  userId: string | null;
  correlationId: string;
  agentName: string;
};

const storage = new AsyncLocalStorage<MonitoringContext>();

export function getMonitoringContext(): MonitoringContext | undefined {
  return storage.getStore();
}

export function runWithMonitoring<T>(context: Omit<MonitoringContext, 'correlationId'> & { correlationId?: string }, fn: () => T): T {
  const current = storage.getStore();
  if (current) return fn();
  return storage.run(
    {
      tenantId: context.tenantId,
      userId: context.userId,
      agentName: context.agentName,
      correlationId: context.correlationId ?? randomUUID(),
    },
    fn,
  );
}
