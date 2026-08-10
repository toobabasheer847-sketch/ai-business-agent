import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GmailOAuthService } from './gmail-oauth';
import { GmailTokenService } from './gmail-tokens';
import { MailOperationsService } from './mail-operations';
import { SmtpConfigurationService } from './smtp-configuration';
import { SmtpMailService } from './smtp-mail.service';

/**
 * GmailIntegrationModule
 *
 * Provides two independent email transports:
 *
 *  1. Gmail API (OAuth 2.0) — MailOperationsService
 *     Tenant-specific. Requires the tenant to have completed the Gmail OAuth
 *     flow. Used by the Communication Agent ADK tools (send_mail, etc.).
 *
 *  2. Gmail SMTP (App Password) — SmtpMailService
 *     Application-level. Requires SMTP_ENABLED=true plus App Password env
 *     vars. Used for system/transactional emails that do not belong to a
 *     specific tenant OAuth context.
 *
 * Both are exported so any consuming module can inject whichever transport
 * it needs without creating a duplicate module.
 */
@Module({
  imports: [ConfigModule],

  providers: [
    GmailOAuthService,
    GmailTokenService,
    MailOperationsService,
    SmtpConfigurationService,
    SmtpMailService,
  ],

  exports: [
    GmailOAuthService,
    GmailTokenService,
    MailOperationsService,
    SmtpConfigurationService,
    SmtpMailService,
  ],
})
export class GmailIntegrationModule {}
