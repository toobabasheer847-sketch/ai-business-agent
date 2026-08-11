import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Represents the resolved SMTP configuration.
 *
 * Transport strategy note
 * -----------------------
 * This project supports TWO independent email sending transports:
 *
 *   1. Gmail API (OAuth 2.0)  — used by MailOperationsService / CommunicationToolsProvider.
 *      Requires a tenant to have completed the Gmail OAuth flow.
 *
 *   2. SMTP via Nodemailer    — used by SmtpMailService.
 *      Requires SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM / SMTP_SECURE
 *      env vars to be provided.  Auto-enabled when all mandatory vars are set.
 *
 * The two transports are independent and do NOT replace each other.
 */
export interface SmtpConfiguration {
  host: string | null;
  port: number | null;
  /** When true, the connection uses TLS from the start (port 465). */
  secure: boolean;
  /** SMTP auth username — typically the Gmail address. */
  user: string | null;
  /** SMTP auth password — must be a Gmail App Password, never the account password. */
  pass: string | null;
  /** The "From" address included in outgoing messages. */
  from: string | null;
  /**
   * Whether this transport is considered active.
   * True when all mandatory env vars (host, port, user, pass, from) are set.
   */
  enabled: boolean;
}

@Injectable()
export class SmtpConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns true when all mandatory SMTP environment variables are present.
   * Mandatory: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
   * SMTP_SECURE defaults to "false" (STARTTLS on port 587) and is optional.
   * Does NOT expose credential values.
   */
  get isSmtpConfigured(): boolean {
    const cfg = this.getConfiguration();
    return Boolean(cfg.host && cfg.port && cfg.user && cfg.pass && cfg.from);
  }

  /**
   * Reads and returns the full SMTP configuration from environment variables
   * via ConfigService.  Never logs password values.
   *
   * Env vars consumed (all via ConfigService, no direct process.env access):
   *   SMTP_HOST     — SMTP server hostname (e.g. smtp.gmail.com for Gmail)
   *   SMTP_PORT     — Port number (587 for STARTTLS, 465 for direct TLS)
   *   SMTP_SECURE   — "true" to use TLS from the start; false/absent → STARTTLS
   *   SMTP_USER     — Gmail address used for SMTP AUTH (e.g. you@gmail.com)
   *   SMTP_PASS     — Gmail App Password (16 chars). NEVER the Google account password.
   *   SMTP_FROM     — "From" header in outgoing emails (can be same as SMTP_USER)
   */
  getConfiguration(): SmtpConfiguration {
    const rawPort = this.configService.get<string | number>('SMTP_PORT');
    const port = rawPort !== undefined && rawPort !== null ? Number(rawPort) : null;
    const validPort = Number.isFinite(port) && port !== null ? port : null;

    const host = this.configService.get<string>('SMTP_HOST') ?? null;
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false')?.toLowerCase() === 'true';
    const user = this.configService.get<string>('SMTP_USER') ?? null;
    const pass = this.configService.get<string>('SMTP_PASS') ?? null;
    const from = this.configService.get<string>('SMTP_FROM') ?? null;

    const enabled = Boolean(host && validPort && user && pass && from);

    return {
      host,
      port: validPort,
      secure,
      user,
      pass,
      from,
      enabled,
    };
  }
}
