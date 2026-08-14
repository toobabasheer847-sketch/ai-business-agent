export default function twilioConfig() {
  return {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID,
    /**
     * Public HTTPS base URL for Twilio inbound webhooks (no trailing slash).
     * Example: https://abcd.ngrok-free.app
     * Used only to build voice/SMS/status callback URLs after Buy Number.
     */
    TWILIO_WEBHOOK_BASE_URL: process.env.TWILIO_WEBHOOK_BASE_URL,
  };
}
