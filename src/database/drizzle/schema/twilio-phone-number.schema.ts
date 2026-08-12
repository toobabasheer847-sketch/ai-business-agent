import { phoneNumbers } from './phone-number.schema';

/**
 * Backwards-compatible alias.
 * There is no separate twilio_phone_numbers table in the live database;
 * phone number rows live in public.phone_numbers.
 */
export const twilioPhoneNumbers = phoneNumbers;
