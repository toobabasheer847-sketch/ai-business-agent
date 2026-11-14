import { MailOperationsService } from './mail-operations';

function decodeBase64Attachment(raw: string): Buffer {
  const match = raw.match(
    /Content-Type: application\/pdf[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/,
  );
  if (!match?.[1]) {
    throw new Error('PDF attachment section not found');
  }
  const normalized = match[1].replace(/\r\n/g, '');
  return Buffer.from(normalized, 'base64');
}

describe('MailOperationsService RFC2822 encoding', () => {
  const service = new MailOperationsService({} as any, {} as any);

  it('keeps plain single-part encoding for emails without attachments', () => {
    const raw = (service as any).encodeMessage({
      to: 'client@example.com',
      subject: 'Hello',
      body: 'Plain body text',
      contentType: 'text/plain',
    });

    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).not.toContain('multipart/mixed');
    expect(raw).toContain('Plain body text');
  });

  it('generates multipart/mixed with a PDF attachment', () => {
    const pdf = Buffer.from('%PDF-1.4 test proposal pdf');
    const raw = (service as any).encodeMessage({
      to: 'client@example.com',
      subject: 'Cyberify Business Proposal',
      body: 'Please find the attached proposal.',
      contentType: 'text/plain',
      attachments: [
        {
          filename: 'Cyberify-Business-Proposal.pdf',
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    expect(raw).toContain('Content-Type: multipart/mixed');
    expect(raw).toContain('Content-Type: application/pdf');
    expect(raw).toContain('Content-Disposition: attachment; filename="Cyberify-Business-Proposal.pdf"');
    expect(raw).toContain('Content-Transfer-Encoding: base64');

    const decoded = decodeBase64Attachment(raw);
    expect(decoded.equals(pdf)).toBe(true);
  });

  it('includes attachment filename and MIME type in multipart messages', () => {
    const raw = (service as any).encodeMessage({
      to: 'client@example.com',
      subject: 'Proposal',
      body: 'Attached.',
      attachments: [
        {
          filename: 'Test-Proposal.pdf',
          content: Buffer.from('%PDF sample'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(raw).toMatch(/filename="Test-Proposal\.pdf"/);
    expect(raw).toContain('application/pdf');
  });
});
