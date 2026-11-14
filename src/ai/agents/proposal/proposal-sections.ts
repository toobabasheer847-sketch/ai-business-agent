export type ProposalSection = {
  heading: string;
  body: string;
};

/**
 * Split generated markdown on ATX headings. Body text is kept as written.
 * Missing headings are omitted rather than filled with placeholder copy.
 */
export function splitProposalSections(content: string | null | undefined): ProposalSection[] {
  if (!content?.trim()) {
    return [];
  }

  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    const heading = rawLine.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      if (current) {
        sections.push(current);
      }
      current = { heading: heading[1].trim(), lines: [] };
      continue;
    }
    if (!current) {
      current = { heading: 'Proposal', lines: [] };
    }
    current.lines.push(rawLine);
  }

  if (current) {
    sections.push(current);
  }

  return sections
    .map((section) => ({
      heading: section.heading,
      body: section.lines.join('\n').trim(),
    }))
    .filter((section) => section.body.length > 0);
}
