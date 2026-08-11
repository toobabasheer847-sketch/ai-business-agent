import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { SmtpConfigurationService } from './smtp-configuration';

/**
 * Input for sending an email via the SMTP transport.
 */
export interface SmtpSendInput {
  /** Recipient email address. */
  to: string;
  /** Email subject line. */
  subject: string;
  /** Plain-text body. */
  text: string;
  /** Optional HTML body. When provided, email clients that support HTML will
   *  render it instead of the plain-text body. */
  html?: string;
}

/**
 * Result returned after a successful SMTP send.
 */
export interface SmtpSendResult {
  /** Nodemailer message-id from the accepted envelope. */
  messageId: string;
  to: string;
  subject: string;
  transport: 'smtp';
}

/**
 * SmtpMailService — Gmail SMTP transport via Nodemailer.
 *
 * Transport strategy
 * ------------------
 * This service is ONE of TWO independent email-sending transports in the
 * project.  It does NOT replace the Gmail API OAuth transport
 * (MailOperationsService).  Both can coexist:
 *
 *   • Gmail API (MailOperationsService) — tenant-specific, OAuth 2.0.
 *     Used by the Communication Agent tools (send_mail, draft_mail, etc.).
 *
 *   • Gmail SMTP (SmtpMailService)       — application-level, App Password.
 *     Used for system/transactional email where an OAuth token is not needed.
 *
 * Activation
 * ----------
 * This service is only active when SMTP_ENABLED=true in environment variables.
 * When disabled, sendEmail() throws a clear error rather than silently
 * dropping messages.
 *
 * Security
 * --------
 * - SMTP_PASS (App Password) is NEVER logged.
 * - Credentials are read-once via SmtpConfigurationService; they are stored
 *   only inside the Nodemailer transport object which does not expose them
 *   through any injectable API.
 * - No real email is sent during application bootstrap.
 */
@Injectable()
export class SmtpMailService implements OnModuleInit {
  private transporter: Transporter | null = null;

  constructor(private readonly smtpConfig: SmtpConfigurationService) {}

  /**
   * Called by NestJS after the module is fully initialized.
   * Creates the Nodemailer transporter if SMTP is enabled.
   * Does NOT verify the connection here — no live SMTP call at startup.
   */
  onModuleInit(): void {
    if (!this.smtpConfig.isSmtpConfigured) {
      // SMTP is disabled or incomplete — service stays inert.
      return;
    }

    const cfg = this.smtpConfig.getConfiguration();

    // Credentials are passed directly into Nodemailer; they are never logged.
    this.transporter = nodemailer.createTransport({
      host: cfg.host!,
      port: cfg.port!,
      secure: cfg.secure,          // false → STARTTLS on port 587
      auth: {
        user: cfg.user!,           // Gmail address
        pass: cfg.pass!,           // Gmail App Password — NOT the account password
      },
      // Force STARTTLS even when secure=false (important for Gmail port 587)
      requireTLS: !cfg.secure,
    });
  }

  /**
   * Returns whether the SMTP transport is ready to send email.
   * Does NOT perform a live connection check.
   */
  get isReady(): boolean {
    return this.transporter !== null;
  }

  /**
   * Performs a non-destructive SMTP connection check (SMTP NOOP / EHLO).
   * Safe to call manually; never called automatically at bootstrap.
   *
   * Returns true if the connection succeeds, false otherwise.
   * Errors are caught internally so callers can decide how to handle them.
   */
  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.transporter) {
      return {
        ok: false,
        error: 'SMTP transport is not configured or is disabled.',
      };
    }

    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Return the error message but do NOT log credentials if they appear
      // in the error text (e.g. "Invalid login: username/password").
      return {
        ok: false,
        error: `SMTP connection check failed: ${message}`,
      };
    }
  }

  /**
   * Sends an email via the configured SMTP transport.
   *
   * @throws Error if SMTP is not configured or the send fails.
   */
  async sendEmail(input: SmtpSendInput): Promise<SmtpSendResult> {
    if (!this.transporter) {
      throw new Error(
        'SMTP transport is not available. ' +
          'Verify that SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM are set.',
      );
    }

    const cfg = this.smtpConfig.getConfiguration();

    const info = await this.transporter.sendMail({
      from: cfg.from ?? cfg.user ?? undefined,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });

    return {
      messageId: info.messageId ?? '',
      to: input.to,
      subject: input.subject,
      transport: 'smtp',
    };
  }
}
