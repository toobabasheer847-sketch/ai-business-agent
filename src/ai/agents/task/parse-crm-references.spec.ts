import { extractCrmReferences } from './parse-crm-references';
import { parseTaskCommand } from './parse-task-command';

describe('extractCrmReferences', () => {
  it('extracts an explicit company name', () => {
    expect(
      extractCrmReferences(
        'Create a task to follow up with ABC company tomorrow.',
      ),
    ).toEqual(
      expect.objectContaining({
        companyQuery: 'ABC',
        explicitCompany: true,
      }),
    );
  });

  it('extracts a person and company from “from” phrasing', () => {
    expect(
      extractCrmReferences('Create a task for Ahmed from ABC tomorrow.'),
    ).toEqual(
      expect.objectContaining({
        personQuery: 'Ahmed',
        companyQuery: 'ABC',
        explicitCompany: false,
      }),
    );
  });

  it('extracts a person without a company keyword', () => {
    expect(extractCrmReferences('Create a task to follow up with Ahmed.')).toEqual(
      expect.objectContaining({
        personQuery: 'Ahmed',
        explicitCompany: false,
      }),
    );
  });

  it('extracts an email address', () => {
    expect(
      extractCrmReferences(
        'Create a task to follow up with john@example.com tomorrow.',
      ),
    ).toEqual(
      expect.objectContaining({
        emailQuery: 'john@example.com',
      }),
    );
  });

  it('extracts a company or person from list phrasing', () => {
    expect(extractCrmReferences('Show my tasks for ABC')).toEqual(
      expect.objectContaining({
        personQuery: 'ABC',
        explicitCompany: false,
      }),
    );
    expect(extractCrmReferences('Show tasks related to Ahmed')).toEqual(
      expect.objectContaining({
        personQuery: 'Ahmed',
      }),
    );
  });

  it('extracts a company from create-for phrasing', () => {
    expect(
      extractCrmReferences(
        'Create a task for ABC to send the proposal tomorrow.',
      ),
    ).toEqual(
      expect.objectContaining({
        personQuery: 'ABC',
      }),
    );
  });
});

describe('parseTaskCommand CRM hints', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('keeps due date parsing while attaching a company hint', () => {
    expect(
      parseTaskCommand(
        'Create a task to follow up with ABC company tomorrow.',
        { now },
      ),
    ).toEqual(
      expect.objectContaining({
        action: 'create',
        title: 'Follow up with ABC company',
        dueAt: '2026-08-21T00:00:00.000Z',
        companyQuery: 'ABC',
        explicitCompany: true,
      }),
    );
  });

  it('parses a CRM-scoped list command', () => {
    expect(parseTaskCommand('Show my tasks for ABC')).toEqual(
      expect.objectContaining({
        action: 'list',
        personQuery: 'ABC',
      }),
    );
  });
});
