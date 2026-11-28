import { BadRequestException } from '@nestjs/common';

import { RevenueGrowthService } from './revenue-growth.service';

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OPP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COMPANY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LEAD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function opportunity(status = 'identified') {
  return {
    id: OPP,
    tenantId: TENANT,
    companyId: COMPANY,
    leadId: LEAD,
    prospectId: null,
    proposalId: null,
    signalKey: `stalled_sales:lead:${LEAD}`,
    opportunityType: 'stalled_sales',
    title: 'Review a quiet lead',
    description: 'This is not a lost sale.',
    evidence: 'Ada was last updated.',
    explicit: false,
    sourceType: 'lead',
    sourceId: LEAD,
    priority: 'low',
    priorityRank: 1,
    prioritySource: 'heuristic',
    confidence: 'low',
    status,
    recommendedAction: 'Decide whether a person should follow up.',
    assignedTo: null,
    taskId: null,
    outcome: null,
    reviewedAt: null,
    resolvedAt: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  };
}

function build() {
  const stored = { opportunity: opportunity(), companyName: 'Northwind' };
  const records = {
    policy: jest.fn().mockResolvedValue(null),
    savePolicy: jest.fn(),
    saveScan: jest.fn(),
    evidence: jest.fn().mockResolvedValue({
      now: new Date('2026-11-26T00:00:00.000Z'),
      leads: [],
      proposals: [],
      messages: [],
      tasks: [],
      acceptedCompanyIds: [],
      truncated: false,
    }),
    stored: jest.fn().mockResolvedValue([]),
    insertOpportunity: jest.fn(),
    updateOpportunity: jest.fn((_tenant: string, _id: string, patch: object) =>
      Promise.resolve({ ...opportunity(), ...patch }),
    ),
    addEvent: jest.fn(),
    opportunity: jest.fn().mockResolvedValue(stored),
    events: jest.fn().mockResolvedValue([
      {
        id: 'event-1',
        fromStatus: null,
        toStatus: 'identified',
        note: 'Identified from stored records.',
      },
    ]),
    plans: jest.fn().mockResolvedValue([]),
    plan: jest.fn(),
    insertPlan: jest.fn().mockResolvedValue({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      opportunityId: OPP,
    }),
    updatePlan: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'open' }),
    companyHasAccepted: jest.fn().mockResolvedValue(false),
    leadStatus: jest.fn().mockResolvedValue('new'),
    userInTenant: jest.fn().mockResolvedValue(true),
    taskForMarker: jest.fn().mockResolvedValue(null),
    snapshot: jest.fn().mockResolvedValue({
      rows: [
        {
          id: OPP,
          type: 'stalled_sales',
          status: 'identified',
          priority: 'low',
          signalKey: `stalled_sales:lead:${LEAD}`,
          title: 'Review a quiet lead',
          evidence: 'Ada was last updated.',
          assignedTo: null,
          companyId: COMPANY,
        },
      ],
      planRows: [],
      overdueIds: [],
    }),
    audit: jest.fn(),
    list: jest.fn(),
  };
  const tasks = {
    createTask: jest
      .fn()
      .mockResolvedValue({ id: '99999999-9999-4999-8999-999999999999' }),
  };
  const exceptions = { recordDrafts: jest.fn().mockResolvedValue(undefined) };
  const workflows = {
    dispatchEvent: jest.fn().mockResolvedValue({ started: 1, failed: 0 }),
  };
  const service = new RevenueGrowthService(
    records as never,
    tasks as never,
    exceptions as never,
    workflows as never,
  );
  return { service, records, tasks, exceptions, workflows, stored };
}

const actor = { tenantId: TENANT, userId: USER, role: 'admin' };

describe('RevenueGrowthService', () => {
  it('keeps discovery inside the caller tenant and does not insert a duplicate signal', async () => {
    const { service, records, exceptions } = build();
    records.evidence.mockResolvedValue({
      now: new Date('2026-11-26T00:00:00.000Z'),
      leads: [
        {
          id: LEAD,
          companyId: COMPANY,
          name: 'Ada',
          status: 'new',
          updatedAt: new Date('2026-10-01T00:00:00.000Z'),
        },
      ],
      proposals: [],
      messages: [],
      tasks: [],
      acceptedCompanyIds: [],
      truncated: false,
    });
    records.stored.mockResolvedValue([
      {
        id: OPP,
        signalKey: `stalled_sales:lead:${LEAD}`,
        status: 'identified',
      },
    ]);
    await service.refresh(actor);
    expect(records.evidence).toHaveBeenCalledWith(TENANT);
    expect(records.insertOpportunity).not.toHaveBeenCalled();
    expect(exceptions.recordDrafts).toHaveBeenCalledWith(
      TENANT,
      expect.any(Array),
    );
  });

  it('records a status change and rejects won, lost, and bad thresholds', async () => {
    const { service, records } = build();
    await service.updateStatus(actor, OPP, 'needs_review');
    expect(records.updateOpportunity).toHaveBeenCalledWith(
      TENANT,
      OPP,
      expect.objectContaining({ status: 'needs_review' }),
    );
    expect(records.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        fromStatus: 'identified',
        toStatus: 'needs_review',
      }),
    );
    records.opportunity.mockResolvedValue({
      opportunity: opportunity('in_progress'),
      companyName: 'Northwind',
    });
    await expect(
      service.updateStatus(actor, OPP, 'won', 'Accepted work'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateStatus(actor, OPP, 'lost'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.savePolicy(actor, { leadQuietDays: 0, proposalFollowUpDays: 7 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns only an active user in the same tenant and reports a failed workflow', async () => {
    const { service, records, exceptions, workflows } = build();
    records.userInTenant.mockResolvedValueOnce(false);
    await expect(service.assign(actor, OPP, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    records.userInTenant.mockResolvedValue(true);
    records.opportunity.mockResolvedValue({
      opportunity: opportunity('needs_review'),
      companyName: 'Northwind',
    });
    workflows.dispatchEvent.mockResolvedValue({ started: 0, failed: 1 });
    await service.updateStatus(actor, OPP, 'qualified');
    expect(workflows.dispatchEvent).toHaveBeenCalledWith(
      TENANT,
      'growth_opportunity_qualified',
      `growth:${OPP}:qualified`,
    );
    expect(exceptions.recordDrafts).toHaveBeenCalledWith(TENANT, [
      expect.objectContaining({ category: 'workflow', sourceId: OPP }),
    ]);
  });

  it('creates one task, blocks an early action plan, and requires an outcome', async () => {
    const { service, records, tasks } = build();
    const created = await service.createTask(actor, OPP);
    expect(created).toEqual({
      taskId: '99999999-9999-4999-8999-999999999999',
      duplicate: false,
      sent: false,
    });
    expect(tasks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY, leadId: LEAD }),
      expect.objectContaining({ tenantId: TENANT, userId: USER }),
    );
    records.opportunity.mockResolvedValue({
      opportunity: { ...opportunity(), taskId: created.taskId },
      companyName: 'Northwind',
    });
    await expect(service.createTask(actor, OPP)).resolves.toEqual({
      taskId: created.taskId,
      duplicate: true,
    });
    await expect(
      service.createPlan(actor, {
        opportunityId: OPP,
        objective: 'Call Ada',
        expectedOutcome: 'A recorded next step',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    records.opportunity.mockResolvedValue({
      opportunity: opportunity('qualified'),
      companyName: 'Northwind',
    });
    const plan = await service.createPlan(actor, {
      opportunityId: OPP,
      objective: 'Call Ada',
      expectedOutcome: 'A recorded next step',
    });
    expect(plan).toEqual(expect.objectContaining({ opportunityId: OPP }));
    expect(records.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: 'qualified',
        toStatus: 'action_planned',
      }),
    );
    await expect(
      service.completePlan(actor, 'ffffffff-ffff-4fff-8fff-ffffffffffff', '  '),
    ).rejects.toBeInstanceOf(BadRequestException);
    records.plan.mockResolvedValue({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      opportunityId: OPP,
      status: 'open',
    });
    records.opportunity.mockResolvedValue({
      opportunity: opportunity('action_planned'),
      companyName: 'Northwind',
    });
    await service.completePlan(
      actor,
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'Called and logged the reply',
    );
    expect(records.updatePlan).toHaveBeenCalledWith(
      TENANT,
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      expect.objectContaining({
        actualOutcome: 'Called and logged the reply',
        status: 'completed',
      }),
    );
  });

  it('returns counts without revenue and keeps a draft unsent', async () => {
    const { service, records } = build();
    records.policy.mockResolvedValue({
      lastInsufficientLeads: 2,
      lastTruncated: false,
    });
    const analytics = await service.analytics(TENANT);
    expect(analytics.revenue).toBeNull();
    expect(analytics.proposalValue).toBeNull();
    expect(analytics.conversionRate).toBeNull();
    expect(analytics.byPriority.low).toBe(1);
    expect(analytics.insufficientLeads).toBe(2);
    records.opportunity.mockResolvedValue({
      opportunity: { ...opportunity(), evidence: 'Offer 50% off' },
      companyName: 'Northwind',
    });
    const draft = await service.draft(actor, OPP);
    expect(draft.sent).toBe(false);
    expect(draft.approvalRequiredToSend).toBe(true);
    expect(draft.consentRequiredToSend).toBe(true);
    expect(draft.body).not.toContain('50%');
    expect(draft.internalSummary).toContain('50%');
    const history = await service.history(TENANT, OPP);
    expect(history[0]?.toStatus).toBe('identified');
  });
});
