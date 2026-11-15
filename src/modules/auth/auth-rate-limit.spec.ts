import { HttpException, HttpStatus } from '@nestjs/common';

import { AuthRateLimiter } from './auth-rate-limit';

describe('AuthRateLimiter', () => {
  it('blocks the 11th login attempt from the same key inside a minute', () => {
    const limiter = new AuthRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      limiter.consume('auth:/login:10.0.0.1', 1_000);
    }

    expect(() => limiter.consume('auth:/login:10.0.0.1', 1_000)).toThrow(HttpException);
    try {
      limiter.consume('auth:/login:10.0.0.1', 1_000);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
