import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { ProposalRecord } from './types/proposal.types.js';

export type ProposalPdfResult = {
  buffer: Buffer;
  filename: string;
  contentType: 'application/pdf';
};

export type ProposalPdfContext = {
  companyName?: string | null;
  prospectName?: string | null;
  brandName?: string | null;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const BODY_SIZE = 11;
const HEADING_SIZE = 16;
const SUBHEADING_SIZE = 13;

@Injectable()
export class ProposalPdfService {
  async generateProposalPdf(
    proposal: ProposalRecord,
    context: ProposalPdfContext = {},
  ): Promise<ProposalPdfResult> {
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const ensureSpace = (needed: number) => {
      if (y - needed < MARGIN) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
    };

    const drawLine = (text: string, size = BODY_SIZE, font = regular, gap = LINE_HEIGHT) => {
      const lines = this.wrapText(text, font, size, PAGE_WIDTH - MARGIN * 2);
      for (const line of lines) {
        ensureSpace(gap);
        page.drawText(line, {
          x: MARGIN,
          y,
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= gap;
      }
    };

    const drawHeading = (text: string) => {
      ensureSpace(HEADING_SIZE + 8);
      y -= 4;
      drawLine(text, HEADING_SIZE, bold, HEADING_SIZE + 6);
      y -= 4;
    };

    const drawSubheading = (text: string) => {
      ensureSpace(SUBHEADING_SIZE + 6);
      y -= 2;
      drawLine(text, SUBHEADING_SIZE, bold, SUBHEADING_SIZE + 4);
    };

    drawHeading(proposal.title?.trim() || 'Business Proposal');

    const meta: string[] = [];
    if (context.companyName?.trim()) {
      meta.push(`Prepared for: ${context.companyName.trim()}`);
    }
    if (context.prospectName?.trim()) {
      meta.push(`Contact: ${context.prospectName.trim()}`);
    }
    if (context.brandName?.trim()) {
      meta.push(`From: ${context.brandName.trim()}`);
    }
    meta.push(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    meta.push(`Reference: ${proposal.id.slice(0, 8).toUpperCase()}`);

    for (const line of meta) {
      drawLine(line, 10, regular, 12);
    }

    y -= 8;

    if (proposal.description?.trim()) {
      drawSubheading('Overview');
      drawLine(proposal.description.trim());
      y -= 4;
    }

    if (proposal.requirements?.trim()) {
      drawSubheading('Requirements');
      drawLine(proposal.requirements.trim());
      y -= 4;
    }

    if (proposal.content?.trim()) {
      drawSubheading('Proposal');
      for (const block of this.parseContentBlocks(proposal.content.trim())) {
        if (block.type === 'heading') {
          drawSubheading(block.text);
        } else {
          drawLine(block.text);
        }
      }
      y -= 4;
    }

    if (proposal.price != null && proposal.price !== '') {
      drawSubheading('Pricing');
      drawLine(`Total: ${proposal.price} ${proposal.currency ?? 'USD'}`);
    }

    if (proposal.validUntil) {
      const validDate =
        proposal.validUntil instanceof Date
          ? proposal.validUntil
          : new Date(proposal.validUntil);
      if (!Number.isNaN(validDate.getTime())) {
        drawLine(
          `Valid until: ${validDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          10,
        );
      }
    }

    const pdfBytes = await doc.save();
    return {
      buffer: Buffer.from(pdfBytes),
      filename: sanitizeProposalFilename(proposal.title),
      contentType: 'application/pdf',
    };
  }

  private wrapText(
    text: string,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    size: number,
    maxWidth: number,
  ): string[] {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length ? lines : [''];
  }

  private parseContentBlocks(content: string): Array<{ type: 'heading' | 'body'; text: string }> {
    const blocks: Array<{ type: 'heading' | 'body'; text: string }> = [];
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        blocks.push({ type: 'heading', text: headingMatch[1].trim() });
        continue;
      }
      blocks.push({ type: 'body', text: line.replace(/^[-*]\s+/, '• ') });
    }
    return blocks;
  }
}

export function sanitizeProposalFilename(title: string | null | undefined): string {
  const raw = (title ?? 'Business-Proposal').trim();
  const sanitized = raw
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\.\./g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  const base = sanitized || 'Business-Proposal';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
