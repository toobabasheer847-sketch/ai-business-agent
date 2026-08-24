import appConfig from './app.config';
import aiConfig from './ai.config';
import gmailConfig from './gmail.config';
import masterSettingsConfig from './master-settings.config';
import stripeConfig from './stripe.config';
import twilioConfig from './twilio.config';

function getRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not configured`);
  }

  return value;
}

export default function configuration() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('JWT_SECRET');
  // AES-256 key for Gmail/Twilio secrets at rest — never invent a default.
  getRequiredEnv('INTEGRATION_ENCRYPTION_KEY');

  return {
    ...appConfig(),
    ...aiConfig(),
    ...twilioConfig(),
    ...gmailConfig(),
    ...masterSettingsConfig(),
    ...stripeConfig(),
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    REDIS_URL: process.env.REDIS_URL,
    redis: {
      url: process.env.REDIS_URL,
    },
  };
}
