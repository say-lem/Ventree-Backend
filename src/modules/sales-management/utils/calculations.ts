interface PriceCalculation {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  profitAmount: number;
}

interface CalculationInput {
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  discount?: number;
  taxRate?: number;
}

/**
 * Calculate sale amounts including discount, tax, and profit
 */
export const calculateSaleAmounts = (input: CalculationInput): PriceCalculation => {
  const { quantity, costPrice, sellingPrice, discount = 0, taxRate = 0 } = input;

  // Subtotal before discount
  const subtotal = quantity * sellingPrice;

  // Calculate discount amount
  const discountAmount = discount > 0 ? (subtotal * discount) / 100 : 0;

  // Amount after discount
  const amountAfterDiscount = subtotal - discountAmount;

  // Calculate tax
  const taxAmount = taxRate > 0 ? (amountAfterDiscount * taxRate) / 100 : 0;

  // Final total
  const totalAmount = amountAfterDiscount + taxAmount;

  // Calculate profit (selling price - cost price) * quantity - discount
  const profitAmount = quantity * (sellingPrice - costPrice) - discountAmount;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    profitAmount,
  };
};

/**
 * Validate discount percentage
 */
export const validateDiscount = (discount: number, maxDiscount: number = 100): boolean => {
  return discount >= 0 && discount <= maxDiscount;
};

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (profit: number, revenue: number): number => {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
};

/**
 * Format currency amount
 */
export const formatCurrency = (amount: number, currency: string = "NGN"): string => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
  }).format(amount);
};