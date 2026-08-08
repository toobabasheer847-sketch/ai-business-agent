import { Injectable, type LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { LoggerContext } from '../../common/helpers/logger.helper';
import { createLogContext } from '../../common/helpers/logger.helper';

@Injectable()
export class AppLogger implements NestLoggerService {
  constructor(private readonly pino: PinoLogger) {}

  private withContext(context?: LoggerContext, extra?: Record<string, unknown>) {
    return extra ? { ...createLogContext(context ?? {}), ...extra } : createLogContext(context ?? {});
  }

  private static isLoggerContext(obj: unknown): obj is LoggerContext {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;
    return 'tenantId' in o || 'userId' in o || 'requestId' in o;
  }

  log(message: unknown, context?: LoggerContext | string, extra?: Record<string, unknown>): void {
    const ctx = typeof context === 'string' ? { requestId: context } : context;
    const msgStr = typeof message === 'string' ? message : String(message);
    this.pino.info(this.withContext(ctx, extra), msgStr);
  }

  error(message: unknown, stackOrContext?: string | LoggerContext, contextOrExtra?: LoggerContext | Record<string, unknown>, extra?: Record<string, unknown>): void {
    let stack: string | undefined;
    let ctx: LoggerContext | undefined;
    let extras: Record<string, unknown> | undefined = extra;

    if (typeof stackOrContext === 'string') {
      stack = stackOrContext;
      if (contextOrExtra && !AppLogger.isLoggerContext(contextOrExtra)) {
        extras = { ...(contextOrExtra as Record<string, unknown>), ...(extras ?? {}) };
      } else {
        ctx = contextOrExtra as LoggerContext;
      }
    } else if (stackOrContext) {
      ctx = stackOrContext as LoggerContext;
    }

    const merge = this.withContext(ctx, extras);
    const logger = this.pino.logger as unknown as { error: (obj: Record<string, unknown>, msg?: unknown) => void };
    const msgStr = typeof message === 'string' ? message : String(message);
    if (stack) {
      logger.error({ ...merge, stack }, msgStr);
    } else {
      this.pino.error(merge, msgStr);
    }
  }

  warn(message: unknown, context?: LoggerContext | string, extra?: Record<string, unknown>): void {
    const ctx = typeof context === 'string' ? { requestId: context } : context;
    const msgStr = typeof message === 'string' ? message : String(message);
    this.pino.warn(this.withContext(ctx, extra), msgStr);
  }

  debug(message: unknown, context?: LoggerContext | string, extra?: Record<string, unknown>): void {
    const ctx = typeof context === 'string' ? { requestId: context } : context;
    const msgStr = typeof message === 'string' ? message : String(message);
    this.pino.debug(this.withContext(ctx, extra), msgStr);
  }

  verbose(message: unknown, context?: LoggerContext | string, extra?: Record<string, unknown>): void {
    const ctx = typeof context === 'string' ? { requestId: context } : context;
    const msgStr = typeof message === 'string' ? message : String(message);
    this.pino.trace(this.withContext(ctx, extra), msgStr);
  }

  fatal(message: unknown, context?: LoggerContext, extra?: Record<string, unknown>): void {
    const msgStr = typeof message === 'string' ? message : String(message);
    this.pino.fatal(this.withContext(context, extra), msgStr);
  }
}