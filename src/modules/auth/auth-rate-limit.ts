import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = number[];

@Injectable()
export class AuthRateLimiter {
  private readonly hits = new Map<string, Bucket>();
  private limit = 10;
  private windowMs = 60_000;

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
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: AuthRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      route?: { path?: string };
    }>();
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const route = request.route?.path ?? 'auth';
    this.limiter.consume(`auth:${route}:${ip}`);
    return true;
  }
}
