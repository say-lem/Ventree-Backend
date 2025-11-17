import crypto from "crypto";

/**
 * Generate SKU (Stock Keeping Unit)
 * Format: CATEGORY-RANDOM-TIMESTAMP
 * Example: ELEC-A7F2-1642
 */
export const generateSKU = (category: string): string => {
  const categoryPrefix = category.substring(0, 4).toUpperCase();
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
  const timestampPart = Date.now().toString().slice(-4);

  return `${categoryPrefix}-${randomPart}-${timestampPart}`;
};

/**
 * Validate SKU format
 */
export const validateSKU = (sku: string): boolean => {
  const skuRegex = /^[A-Z]{2,4}-[A-F0-9]{4}-[0-9]{4}$/;
  return skuRegex.test(sku);
};

/**
 * Generate barcode (EAN-13 format)
 */
// export const generateBarcode = (): string => {
//   // Generate 12 random digits
//   const randomDigits = Array.from({ length: 12 }, () =>
//     Math.floor(Math.random() * 10)
//   ).join("");

//   // Calculate check digit
//   let sum = 0;
//   for (let i = 0; i < 12; i++) {
//     const digit = parseInt(randomDigits[i]);
//     sum += i % 2 === 0 ? digit : digit * 3;
//   }
//   const checkDigit = (10 - (sum % 10)) % 10;

//   return randomDigits + checkDigit;
// };