import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { Permission } from './permissions';
import { ROUTE_PERMISSIONS } from './route-permissions';

const PUBLIC_HANDLERS = new Set([
  'AppController.getHello',
  'HealthController.health',
  'AuthController.register',
  'AuthController.login',
  'AuthController.me',
  'GmailController.callback',
  'PublicProposalController.get',
  'PublicProposalController.pdf',
  'PublicProposalController.accept',
  'PublicProposalController.reject',
  'PublicCustomerChatController.bootstrap',
  'PublicCustomerChatController.start',
  'PublicCustomerChatController.history',
  'PublicCustomerChatController.send',
  'PublicCustomerChatController.details',
  'PublicCustomerChatController.handoff',
  'PublicCustomerChatController.end',
]);

function controllerFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...controllerFiles(full));
    } else if (entry.endsWith('.controller.ts')) {
      files.push(full);
    }
  }
  return files;
}

function handlerKeys(source: string): string[] {
  const keys: string[] = [];
  const classPattern = /export class (\w+)/g;
  let classMatch: RegExpExecArray | null;
  while ((classMatch = classPattern.exec(source))) {
    const className = classMatch[1];
    const nextClass = source.indexOf('export class ', classMatch.index + classMatch[0].length);
    const body = source.slice(classMatch.index, nextClass === -1 ? undefined : nextClass);
    let httpHandler = false;
    for (const line of body.split('\n')) {
      if (/@(?:Get|Post|Patch|Put|Delete)\(/.test(line)) {
        httpHandler = true;
        continue;
      }
      if (!httpHandler || line.trim().startsWith('@')) {
        continue;
      }
      if (!/^ {2}(?:public |private |protected )?(?:async )?[A-Za-z_]/.test(line)) {
        continue;
      }
      const method = line.match(/^\s*(?:public |private |protected )?(?:async )?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (!method || method[1] === 'constructor') {
        continue;
      }
      keys.push(`${className}.${method[1]}`);
      httpHandler = false;
    }
  }
  return keys;
}

describe('route permission coverage', () => {
  const handlers = controllerFiles(join(process.cwd(), 'src')).flatMap((file) =>
    handlerKeys(readFileSync(file, 'utf8')),
  );

  it('gives every protected controller method an explicit policy', () => {
    const missing = handlers.filter((handler) => !PUBLIC_HANDLERS.has(handler) && !ROUTE_PERMISSIONS[handler]);
    expect(missing).toEqual([]);
  });

  it('leaves token and OAuth callback routes outside the permission map', () => {
    expect(ROUTE_PERMISSIONS['GmailController.callback']).toBeUndefined();
    expect(ROUTE_PERMISSIONS['GmailController.authorize']).toEqual([Permission.IntegrationManage]);
    expect(ROUTE_PERMISSIONS['PublicProposalController.get']).toBeUndefined();
    expect(ROUTE_PERMISSIONS['PublicProposalController.accept']).toBeUndefined();
    expect(ROUTE_PERMISSIONS['PublicCustomerChatController.send']).toBeUndefined();
  });

  it('requires assistant access for authenticated status endpoints', () => {
    expect(ROUTE_PERMISSIONS['MasterAgentController.getStatus']).toEqual([Permission.AssistantUse]);
    expect(ROUTE_PERMISSIONS['CommunicationAgentController.getStatus']).toEqual([Permission.AssistantUse]);
  });
});
