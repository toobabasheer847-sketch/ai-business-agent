import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IntegrationEncryptionService } from './integration-encryption.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [IntegrationEncryptionService],
  exports: [IntegrationEncryptionService],
})
export class SecurityModule {}
