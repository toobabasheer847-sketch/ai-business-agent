import { HttpException, HttpStatus } from '@nestjs/common';

import {
  PublicProposalRateLimitGuard,
  PublicProposalRateLimiter,
} from './public-proposal-rate-limit';

describe('PublicProposalRateLimiter', () => {
  it('rejects requests after the window limit', () => {
    const limiter = new PublicProposalRateLimiter();
    limiter.configure(2, 60_000);

    limiter.consume('public-proposal:10.0.0.1', 1_000);
    limiter.consume('public-proposal:10.0.0.1', 1_100);

    expect(() => limiter.consume('public-proposal:10.0.0.1', 1_200)).toThrow(HttpException);
    try {
      limiter.consume('public-proposal:10.0.0.1', 1_200);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('does not share a bucket across addresses', () => {
    const limiter = new PublicProposalRateLimiter();
    limiter.configure(1, 60_000);
    limiter.consume('public-proposal:10.0.0.1', 1_000);
    expect(() => limiter.consume('public-proposal:10.0.0.2', 1_100)).not.toThrow();
  });
});

describe('PublicProposalRateLimitGuard', () => {
  it('uses the request address as the limit key', () => {
    const limiter = new PublicProposalRateLimiter();
    const consume = jest.spyOn(limiter, 'consume').mockImplementation(() => undefined);
    const guard = new PublicProposalRateLimitGuard(limiter);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.8' }),
      }),
    };

    expect(guard.canActivate(context as any)).toBe(true);
    expect(consume).toHaveBeenCalledWith('public-proposal:203.0.113.8');
  });
});
