import { ConfigService } from '@nestjs/config';

import { resolveAdkModelName, resolveAdkModelFromContext } from './resolve-adk-model';
import { runWithAiContext } from './ai-request-context';

describe('resolveAdkModelName', () => {
  const configService = {
    get: jest.fn().mockReturnValue('gemini-2.0-flash'),
  } as unknown as ConfigService;

  it('prefers tenant master_settings aiModel over env default', () => {
    expect(resolveAdkModelName(configService, 'gemini-2.5-pro')).toBe(
      'gemini-2.5-pro',
    );
  });

  it('reads aiModel from trusted AI context', () => {
    runWithAiContext(
      {
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '11111111-1111-4111-8111-111111111111',
        aiModel: 'gemini-custom',
      },
      () => {
        expect(resolveAdkModelFromContext(configService)).toBe('gemini-custom');
      },
    );
  });
});
