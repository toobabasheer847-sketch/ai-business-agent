export default function twilioConfig() {
  return {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID,
  };
}
