import { Global, Module, InjectionToken } from '@nestjs/common';
import { DatabaseService } from './database.service';
import type { DrizzleDb } from './database.service';

export const DRIZZLE_DB: InjectionToken<DrizzleDb> = Symbol('DRIZZLE_DB');

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: DRIZZLE_DB,
      useFactory: (databaseService: DatabaseService) => databaseService.getDb(),
      inject: [DatabaseService],
    },
  ],
  exports: [DatabaseService, DRIZZLE_DB],})
export class DatabaseModule {}
