import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = number[];

@Injectable()
export class PublicProposalRateLimiter {
  private readonly hits = new Map<string, Bucket>();
  private limit = 30;
  private windowMs = 60_000;

  configure(limit: number, windowMs = 60_000): void {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  consume(key: string, now = Date.now()): void {
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
export class PublicProposalRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: PublicProposalRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
    }>();
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    this.limiter.consume(`public-proposal:${ip}`);
    return true;
  }
}
