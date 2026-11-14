import { splitProposalSections } from './proposal-sections';

describe('splitProposalSections', () => {
  it('keeps markdown sections and drops empty headings', () => {
    const sections = splitProposalSections(`
## Services
Design and implementation

## Timeline
Four weeks

## Payment terms
50% on acceptance
`);

    expect(sections.map((section) => section.heading)).toEqual([
      'Services',
      'Timeline',
      'Payment terms',
    ]);
    expect(sections[0].body).toContain('Design and implementation');
  });

  it('returns no sections when content is empty', () => {
    expect(splitProposalSections('   ')).toEqual([]);
  });
});
