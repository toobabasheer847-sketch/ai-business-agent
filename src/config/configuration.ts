import appConfig from './app.config';
import aiConfig from './ai.config';
import gmailConfig from './gmail.config';
import masterSettingsConfig from './master-settings.config';
import stripeConfig from './stripe.config';
import twilioConfig from './twilio.config';

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not configured`);
  }

  return value;
}

export default function configuration() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('JWT_SECRET');

  return {
    ...appConfig(),
    ...aiConfig(),
    ...twilioConfig(),
    ...gmailConfig(),
    ...masterSettingsConfig(),
    ...stripeConfig(),
  };
}
