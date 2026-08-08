import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

import { AppLogger } from '../infrastructure/logging/logger.service';
import * as schema from './drizzle/schema';

export type DrizzleDb = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly db: DrizzleDb;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
    });

    this.db = drizzle(this.pool, {
      schema,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');

    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing database pool');
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }

  getDb(): DrizzleDb {
    return this.db;
  }
}
