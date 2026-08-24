import { ConfigService } from '@nestjs/config';

import { resolveAdkModelName, resolveAdkModelFromContext } from './resolve-adk-model';
import { runWithAiContext } from './ai-request-context';

describe('resolveAdkModelName', () => {
  const configService = {
    get: jest.fn().mockReturnValue('gemini-2.0-flash'),
  } as unknown as ConfigService;

  beforeEach(() => {
    (configService.get as jest.Mock).mockReturnValue('gemini-2.0-flash');
  });

  it('prefers allowlisted tenant master_settings aiModel over env default', () => {
    expect(resolveAdkModelName(configService, 'gemini-2.5-pro')).toBe(
      'gemini-2.5-pro',
    );
  });

  it('accepts gemini-3.6-flash as a tenant-selectable allowlisted model', () => {
    expect(resolveAdkModelName(configService, 'gemini-3.6-flash')).toBe(
      'gemini-3.6-flash',
    );
  });

  it('falls back to GEMINI_MODEL when tenant model is missing', () => {
    expect(resolveAdkModelName(configService, null)).toBe('gemini-2.0-flash');
    expect(resolveAdkModelName(configService, '')).toBe('gemini-2.0-flash');
  });

  it('falls back to GEMINI_MODEL when tenant model is not allowlisted', () => {
    expect(resolveAdkModelName(configService, 'gemini-custom')).toBe(
      'gemini-2.0-flash',
    );
    expect(resolveAdkModelName(configService, 'gpt-4o')).toBe('gemini-2.0-flash');
  });

  it('falls back to GEMINI_MODEL=gemini-3.6-flash when tenant model is invalid', () => {
    (configService.get as jest.Mock).mockReturnValue('gemini-3.6-flash');
    expect(resolveAdkModelName(configService, null)).toBe('gemini-3.6-flash');
    expect(resolveAdkModelName(configService, 'evil-model')).toBe(
      'gemini-3.6-flash',
    );
  });

  it('never uses another arbitrary model string from the database', () => {
    (configService.get as jest.Mock).mockReturnValue('gemini-1.5-flash');
    expect(resolveAdkModelName(configService, 'evil-model')).toBe(
      'gemini-1.5-flash',
    );
  });

  it('reads allowlisted aiModel from trusted AI context', () => {
    runWithAiContext(
      {
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '11111111-1111-4111-8111-111111111111',
        aiModel: 'gemini-2.5-flash',
      },
      () => {
        expect(resolveAdkModelFromContext(configService)).toBe(
          'gemini-2.5-flash',
        );
      },
    );
  });

  it('reads gemini-3.6-flash from trusted AI context when allowlisted', () => {
    runWithAiContext(
      {
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '11111111-1111-4111-8111-111111111111',
        aiModel: 'gemini-3.6-flash',
      },
      () => {
        expect(resolveAdkModelFromContext(configService)).toBe(
          'gemini-3.6-flash',
        );
      },
    );
  });
});
