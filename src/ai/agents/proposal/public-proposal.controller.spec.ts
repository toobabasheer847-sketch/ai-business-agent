import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RejectPublicProposalDto } from './dto/reject-public-proposal.dto';
import { generateProposalAccessToken } from './proposal-access-token';
import { PublicProposalController } from './public-proposal.controller';
import { PublicProposalRateLimitGuard } from './public-proposal-rate-limit';

describe('PublicProposalController', () => {
  const access = {
    getProposal: jest.fn(),
    accept: jest.fn(),
    reject: jest.fn(),
    downloadPdf: jest.fn(),
  };
  const controller = new PublicProposalController(access as any);
  const token = generateProposalAccessToken();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is public and rate limited, without the JWT guard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PublicProposalController) ?? [];
    expect(guards).toContain(PublicProposalRateLimitGuard);
    expect(guards).not.toContain(JwtAuthGuard);
  });

  it('rejects malformed tokens before touching the proposal', () => {
    expect(() => controller.get('not-a-token')).toThrow(NotFoundException);
    expect(() => controller.get('11111111-1111-4111-8111-111111111111')).toThrow(
      NotFoundException,
    );
    expect(access.getProposal).not.toHaveBeenCalled();
  });

  it('passes a well-formed token through without a tenant id', async () => {
    access.getProposal.mockResolvedValue({ title: 'Proposal' });
    await controller.get(token);
    expect(access.getProposal).toHaveBeenCalledWith(token);
  });
});

describe('RejectPublicProposalDto', () => {
  it('requires a reason and rejects unexpected fields at the class boundary', async () => {
    const missing = plainToInstance(RejectPublicProposalDto, {});
    const missingErrors = await validate(missing);
    expect(missingErrors.length).toBeGreaterThan(0);

    const tooLong = plainToInstance(RejectPublicProposalDto, { reason: 'x'.repeat(501) });
    expect((await validate(tooLong)).length).toBeGreaterThan(0);

    const ok = plainToInstance(RejectPublicProposalDto, { reason: 'Timing does not work.' });
    expect(await validate(ok)).toEqual([]);
  });
});
