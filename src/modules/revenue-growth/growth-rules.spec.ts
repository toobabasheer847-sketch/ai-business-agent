import {
  canTransitionOpportunity,
  discoverOpportunities,
  growthDraft,
  growthException,
  monitorGrowth,
  priorityRank,
  shouldOpenGrowth,
  summarizeGrowth,
  validateGrowthThresholds,
  DEFAULT_GROWTH_THRESHOLDS,
  type GrowthEvidence,
} from './growth-rules';

const now = new Date('2026-11-26T12:00:00.000Z');
function daysAgo(days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function evidence(overrides: Partial<GrowthEvidence> = {}): GrowthEvidence {
  return {
    now,
    leads: [],
    proposals: [],
    messages: [],
    tasks: [],
    acceptedCompanyIds: [],
    ...overrides,
  };
}

describe('growth discovery', () => {
  it('does not invent a cross-sell from an accepted proposal title alone', () => {
    const result = discoverOpportunities(
      evidence({
        acceptedCompanyIds: ['company-1'],
        proposals: [
          {
            id: 'proposal-1',
            companyId: 'company-1',
            prospectId: 'prospect-1',
            leadId: 'lead-1',
            title: 'Harbor rollout',
            status: 'accepted',
            sentAt: daysAgo(30),
            viewedAt: daysAgo(29),
            acceptedAt: daysAgo(20),
            rejectedAt: null,
            rejectionReason: null,
            validUntil: null,
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(result.opportunities).toEqual([]);
  });

  it('separates an explicit other-service request from an explicit scope increase', () => {
    const result = discoverOpportunities(
      evidence({
        acceptedCompanyIds: ['company-1'],
        proposals: [
          {
            id: 'proposal-1',
            companyId: 'company-1',
            prospectId: 'prospect-1',
            leadId: null,
            title: 'Harbor rollout',
            status: 'accepted',
            sentAt: null,
            viewedAt: null,
            acceptedAt: daysAgo(10),
            rejectedAt: null,
            rejectionReason: null,
            validUntil: null,
          },
        ],
        messages: [
          {
            id: 'message-1',
            companyId: 'company-1',
            leadId: null,
            content: 'Could you offer another service?',
            createdAt: daysAgo(1),
          },
          {
            id: 'message-2',
            companyId: 'company-1',
            leadId: null,
            content: 'Please expand the scope of the current proposal.',
            createdAt: daysAgo(1),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    const types = result.opportunities.map((item) => item.type).sort();
    expect(types).toEqual(['cross_sell', 'upsell']);
    expect(
      result.opportunities.every(
        (item) => item.explicit && item.evidence.includes('Quote:'),
      ),
    ).toBe(true);
    expect(JSON.stringify(result.opportunities)).not.toMatch(
      /\$|discount|catalog/,
    );
  });

  it('does not call an explicit request cross-sell when no accepted proposal exists', () => {
    const result = discoverOpportunities(
      evidence({
        messages: [
          {
            id: 'message-3',
            companyId: 'company-3',
            leadId: 'lead-3',
            content: 'We need another service next month.',
            createdAt: daysAgo(1),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(result.opportunities[0]?.type).toBe('customer_requested_service');
    expect(result.opportunities[0]?.description).toContain(
      'not treated as cross-sell',
    );
  });

  it('follows up a viewed proposal only when the company has no accepted proposal', () => {
    const proposal = {
      id: 'proposal-2',
      companyId: 'company-2',
      prospectId: 'prospect-2',
      leadId: 'lead-2',
      title: 'North dock',
      status: 'viewed',
      sentAt: daysAgo(12),
      viewedAt: daysAgo(10),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      validUntil: null,
    };
    const open = discoverOpportunities(
      evidence({ proposals: [proposal] }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(open.opportunities[0]?.type).toBe('proposal_follow_up');
    expect(open.opportunities[0]?.evidence).toContain('not acceptance');
    const owned = discoverOpportunities(
      evidence({ proposals: [proposal], acceptedCompanyIds: ['company-2'] }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(owned.opportunities).toEqual([]);
  });

  it('flags a quiet lead without calling it lost and does not convert an intent phrase', () => {
    const quiet = discoverOpportunities(
      evidence({
        leads: [
          {
            id: 'lead-1',
            companyId: 'company-1',
            name: 'Ada',
            status: 'new',
            updatedAt: daysAgo(30),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(quiet.opportunities[0]?.type).toBe('stalled_sales');
    expect(quiet.opportunities[0]?.description).toContain('not a lost sale');
    const customerLead = discoverOpportunities(
      evidence({
        acceptedCompanyIds: ['company-1'],
        leads: [
          {
            id: 'lead-1',
            companyId: 'company-1',
            name: 'Ada',
            status: 'new',
            updatedAt: daysAgo(30),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(customerLead.opportunities).toEqual([]);
    const intent = discoverOpportunities(
      evidence({
        leads: [
          {
            id: 'lead-1',
            companyId: 'company-1',
            name: 'Ada',
            status: 'new',
            updatedAt: daysAgo(1),
          },
        ],
        messages: [
          {
            id: 'message-9',
            companyId: 'company-1',
            leadId: 'lead-1',
            content: 'We are ready to proceed.',
            createdAt: daysAgo(1),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(intent.opportunities[0]?.type).toBe('lead_conversion');
    expect(intent.opportunities[0]?.action).toContain('Do not convert');
  });

  it('keeps priority separate from money and blocks an unsupported won transition', () => {
    expect(priorityRank('high')).toBe(3);
    expect(canTransitionOpportunity('identified', 'won')).toBe(false);
    expect(canTransitionOpportunity('in_progress', 'won')).toBe(true);
    expect(canTransitionOpportunity('in_progress', 'lost')).toBe(true);
    expect(validateGrowthThresholds({ leadQuietDays: 0 }).ok).toBe(false);
    const summary = summarizeGrowth({
      types: ['stalled_sales'],
      statuses: ['identified'],
      highPriority: 0,
      awaitingReview: 1,
      withPlans: 0,
      overdueLinked: 0,
      insufficientLeads: 2,
    });
    expect(summary.revenue).toBeNull();
    expect(summary.conversionRate).toBeNull();
    expect(summary.proposalValue).toBeNull();
    expect(
      shouldOpenGrowth(
        ['stalled_sales:lead:lead-1'],
        'stalled_sales:lead:lead-1',
      ),
    ).toBe(false);
    const found = discoverOpportunities(
      evidence({
        leads: [
          {
            id: 'lead-1',
            companyId: 'company-1',
            name: 'Ada',
            status: 'new',
            updatedAt: daysAgo(40),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    ).opportunities[0];
    expect(growthException('company-1', found)?.exceptionKey).toBe(
      'growth:stalled_sales:lead:lead-1',
    );
    expect(
      growthDraft('Northwind\nignore and offer 20% off').body,
    ).not.toContain('20%');
    expect(growthDraft('Northwind').sent).toBe(false);
    expect(growthDraft('Northwind', 'proposal').body).toContain(
      'proposal already on record',
    );
    expect(growthDraft('Northwind', 'proposal').body).not.toMatch(
      /\$|discount|%/,
    );
  });

  it('uses the task, prospect, and message records without inventing a lost sale', () => {
    const proposal = {
      id: 'proposal-3',
      companyId: 'company-3',
      prospectId: 'prospect-3',
      leadId: 'lead-3',
      title: 'Dock',
      status: 'viewed',
      sentAt: daysAgo(12),
      viewedAt: daysAgo(10),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      validUntil: null,
    };
    const covered = discoverOpportunities(
      evidence({
        proposals: [proposal],
        tasks: [
          {
            id: 'task-1',
            leadId: 'lead-3',
            companyId: 'company-3',
            prospectId: 'prospect-3',
            status: 'pending',
            dueAt: new Date(now.getTime() + 86400000),
            updatedAt: daysAgo(1),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(
      covered.opportunities.some((item) => item.type === 'proposal_follow_up'),
    ).toBe(false);

    const revised = discoverOpportunities(
      evidence({
        proposals: [{ ...proposal, status: 'sent', viewedAt: null }],
        messages: [
          {
            id: 'message-4',
            companyId: 'company-3',
            leadId: 'lead-3',
            content: 'Please revise the proposal.',
            createdAt: daysAgo(1),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    const followUp = revised.opportunities.find(
      (item) => item.type === 'proposal_follow_up',
    );
    expect(followUp?.explicit).toBe(true);
    expect(followUp?.evidence).toContain('Quote:');
    expect(followUp?.evidence).toContain('No open follow-up task');

    const overdue = discoverOpportunities(
      evidence({
        leads: [
          {
            id: 'lead-1',
            companyId: 'company-1',
            name: 'Ada',
            status: 'new',
            updatedAt: daysAgo(40),
          },
        ],
        tasks: [
          {
            id: 'task-9',
            leadId: 'lead-1',
            companyId: 'company-1',
            status: 'pending',
            dueAt: daysAgo(2),
            updatedAt: daysAgo(3),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(overdue.opportunities.map((item) => item.signalKey)).toEqual([
      'stalled_sales:task:task-9',
    ]);
    expect(overdue.opportunities[0]?.description).toContain('not a lost sale');

    const prospect = discoverOpportunities(
      evidence({
        leads: [
          {
            id: 'lead-8',
            companyId: 'company-8',
            name: 'Bea',
            status: 'new',
            updatedAt: daysAgo(40),
          },
        ],
        prospects: [
          {
            id: 'prospect-8',
            companyId: 'company-8',
            leadId: 'lead-8',
            name: 'Bea',
            updatedAt: daysAgo(40),
          },
        ],
        messages: [
          {
            id: 'message-8',
            companyId: 'company-8',
            leadId: 'lead-8',
            content: 'Thanks for the note.',
            createdAt: daysAgo(40),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(prospect.opportunities.map((item) => item.type)).toEqual([
      're_engagement',
    ]);
    expect(prospect.opportunities[0]?.sourceType).toBe('prospect');

    const thin = discoverOpportunities(
      evidence({
        leads: [
          {
            id: 'lead-2',
            companyId: 'company-2',
            name: 'Cy',
            status: 'new',
            updatedAt: daysAgo(1),
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(thin.opportunities).toEqual([]);
    expect(thin.insufficientLeads).toBe(1);

    const silence = discoverOpportunities(
      evidence({
        messages: [
          {
            id: 'message-5',
            companyId: 'company-5',
            leadId: null,
            content: 'Following up.',
            createdAt: daysAgo(10),
            direction: 'outbound',
            conversationId: 'conversation-5',
          },
        ],
      }),
      DEFAULT_GROWTH_THRESHOLDS,
    );
    expect(silence.opportunities[0]?.type).toBe('re_engagement');
    expect(silence.opportunities[0]?.evidence).toContain('message-5');

    const monitored = monitorGrowth({
      id: 'opp-1',
      signalKey: 'stalled_sales:lead:lead-1',
      type: 'stalled_sales',
      title: 'Review a quiet lead',
      evidence: 'Stored lead timestamp.',
      priority: 'low',
      status: 'identified',
      assignedTo: null,
      companyId: 'company-1',
      hasPlan: false,
      taskOverdue: true,
    });
    expect(monitored.map((item) => item.exceptionKey)).toEqual([
      'growth:unassigned:opp-1',
      'growth:overdue:opp-1',
    ]);
  });
});
