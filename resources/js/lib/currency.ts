/**
 * Round amount to 2 decimal places
 * @param amount - The amount to round
 * @returns Rounded amount
 */
export function roundToTwoDecimals(amount: number): number {
    return Math.round(amount * 100) / 100;
}

/**
 * Format amount as currency (German format)
 * @param amount - The amount to format
 * @returns Formatted string (e.g., "100,00 €")
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Calculate VAT from gross amount
 * @param gross - Gross amount
 * @param vatRate - VAT rate (19, 7, or 0)
 * @returns Object with net, tax, and gross amounts (all rounded to 2 decimals)
 */
export function calculateVAT(gross: number, vatRate: number): {
    gross: number;
    net: number;
    tax: number;
} {
    const grossRounded = roundToTwoDecimals(gross);
    const vatRateNum = vatRate === 0 ? 0 : vatRate;
    const netAmount = grossRounded / (1 + vatRateNum / 100);
    const netRounded = roundToTwoDecimals(netAmount);
    const taxRounded = roundToTwoDecimals(grossRounded - netRounded);

    return {
        gross: grossRounded,
        net: netRounded,
        tax: taxRounded,
    };
}
