import { parsePhoneNumber, CountryCode } from "libphonenumber-js";

/**
 * Normalize phone number to E.164 format
 * @param phoneNumber - Phone number to normalize
 * @param defaultCountry - Default country code (defaults to 'NG' for Nigeria)
 * @returns Normalized phone number in E.164 format
 * @throws ValidationError if phone number is invalid
 */
export const normalizePhoneNumber = (
  phoneNumber: string,
  defaultCountry: CountryCode = "NG"
): string => {
  try {
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry);
    if (!parsed.isValid()) {
      throw new Error("Invalid phone number");
    }
    return parsed.number; // Returns E.164 format (e.g., +2349012345678)
  } catch (error) {
    throw new Error(`Invalid phone number format: ${phoneNumber}`);
  }
};

