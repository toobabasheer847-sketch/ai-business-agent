import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { customerRateKey } from './customer-facing';

type Bucket = number[];

@Injectable()
export class CustomerChatRateLimiter {
  private readonly hits = new Map<string, Bucket>();
  private limit = 20;
  private windowMs = 60_000;

  configure(limit: number, windowMs = 60_000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  consume(key: string, now = Date.now()) {
    const recent = (this.hits.get(key) ?? []).filter((stamp) => now - stamp < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      throw new HttpException('Too many requests. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}

@Injectable()
export class CustomerChatRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: CustomerChatRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ ip?: string; socket?: { remoteAddress?: string } }>();
    this.limiter.consume(customerRateKey(request.ip || request.socket?.remoteAddress || 'unknown'));
    return true;
  }
}
