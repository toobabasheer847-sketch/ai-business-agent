import { normalizeCrmIds } from './resolve-crm-ids';

describe('normalizeCrmIds', () => {
  it('treats empty strings as cleared links', () => {
    expect(
      normalizeCrmIds({
        companyId: '',
        prospectId: undefined,
        leadId: null,
      }),
    ).toEqual({
      companyId: null,
      prospectId: undefined,
      leadId: null,
    });
  });
});
