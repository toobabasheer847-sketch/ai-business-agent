import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { DatabaseService } from './database/database.service';

@Controller()
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  async health() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.database.getPool().query('SELECT 1');
      database = 'up';
    } catch {
      throw new ServiceUnavailableException('Service is unavailable');
    }

    return {
      status: 'ok',
      database,
      redis: await this.redisStatus(),
    };
  }

  private async redisStatus(): Promise<'not_configured' | 'up' | 'down'> {
    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      return 'not_configured';
    }

    const client = new Redis(redisUrl, {
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    try {
      await client.connect();
      const reply = await client.ping();
      return reply === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      client.disconnect();
    }
  }
}
