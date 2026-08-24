import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  decryptIntegrationSecret,
  decryptStoredIntegrationSecret,
  encryptIntegrationSecret,
  isEncryptedIntegrationSecret,
  resolveIntegrationEncryptionKey,
} from './integration-encryption.js';

/**
 * Application-level AES-256-GCM encryption for tenant integration secrets
 * (Gmail OAuth/SMTP tokens, Twilio authToken).
 *
 * Decrypt only at the point of use inside integration services.
 * Never log, return, or pass plaintext secrets to the model.
 */
@Injectable()
export class IntegrationEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.key = resolveIntegrationEncryptionKey(
      this.configService.get<string>('INTEGRATION_ENCRYPTION_KEY'),
      this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV,
    );
  }

  isEncrypted(value: string | null | undefined): boolean {
    return isEncryptedIntegrationSecret(value);
  }

  /**
   * Encrypt a secret for storage. Null/undefined pass through.
   * Empty string stays empty. Already-encrypted values are left unchanged.
   */
  encrypt(plaintext: string | null | undefined): string | null | undefined {
    if (plaintext === undefined) {
      return undefined;
    }
    if (plaintext === null) {
      return null;
    }
    if (plaintext === '') {
      return '';
    }
    return encryptIntegrationSecret(plaintext, this.key);
  }

  /**
   * Decrypt a stored value. Encrypted → plaintext; legacy plaintext → as-is.
   */
  decryptStored(value: string | null | undefined): {
    plaintext: string | null;
    wasLegacy: boolean;
  } {
    return decryptStoredIntegrationSecret(value, this.key);
  }

  /**
   * Decrypt a known ciphertext. Throws if not encrypted or tampered.
   */
  decrypt(ciphertext: string): string {
    return decryptIntegrationSecret(ciphertext, this.key);
  }

  /**
   * Encrypt if the value is non-empty plaintext; leave null/undefined/empty alone.
   */
  encryptIfPresent(
    value: string | null | undefined,
  ): string | null | undefined {
    return this.encrypt(value);
  }
}
