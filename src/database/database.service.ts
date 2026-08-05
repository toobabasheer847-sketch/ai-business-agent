import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');

    console.log('Database connected successfully');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }
}
