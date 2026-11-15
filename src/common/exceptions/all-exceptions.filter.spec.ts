import { HttpException, HttpStatus } from '@nestjs/common';

import { AllExceptionsFilter } from './all-exceptions.filter';

function host() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    status,
    json,
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'GET',
          url: '/api/companies',
          headers: {},
          user: { userId: 'user-1', tenantId: 'tenant-1' },
        }),
      }),
    },
  };
}

describe('AllExceptionsFilter', () => {
  const logger = { error: jest.fn(), warn: jest.fn() };

  it('hides unexpected error details in production', () => {
    const filter = new AllExceptionsFilter(logger as never, {
      get: () => 'production',
    } as never);
    const http = host();

    filter.catch(new Error('password authentication failed for user "postgres"'), http.host as never);

    expect(http.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(http.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Internal server error',
    }));
    expect(JSON.stringify(http.json.mock.calls[0][0])).not.toContain('postgres');
  });

  it('keeps an intentional HTTP error message', () => {
    const filter = new AllExceptionsFilter(logger as never, {
      get: () => 'production',
    } as never);
    const http = host();

    filter.catch(new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED), http.host as never);

    expect(http.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: 'Invalid email or password',
    }));
  });
});
