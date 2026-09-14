// Currency utilities for formatting and managing school-configured currencies

/**
 * Format a numeric value using a currency code
 * @param {number} amount - The numeric amount to format
 * @param {string} currencyCode - The currency code (e.g., 'GHS', 'USD', 'NGN')
 * @returns {string} Formatted currency string (e.g., 'GHS 1,234.56')
 */
export function formatCurrencyValue(amount, currencyCode = 'USD') {
  const numericValue = Number(amount) || 0;
  if (!Number.isFinite(numericValue)) return `${String(currencyCode || 'USD').trim().toUpperCase()} 0`;
  
  const formatted = numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  const code = String(currencyCode || 'USD').trim().toUpperCase();
  return `${code} ${formatted}`;
}

/**
 * Extract the currency code from a school object
 * Checks school.currency first, then school.branding.currency, defaults to USD
 * @param {object} school - The school/tenant object
 * @returns {string} Currency code (e.g., 'GHS', 'USD')
 */
export function getSchoolCurrency(school = {}) {
  const schoolCurrency = String(school.currency || '').trim();
  if (schoolCurrency) return schoolCurrency;
  
  const brandingCurrency = String(school.branding?.currency || '').trim();
  if (brandingCurrency) return brandingCurrency;
  
  return 'USD';
}

/**
 * Format a currency value using the school's configured currency
 * @param {number} amount - The numeric amount
 * @param {object} school - The school object with currency configuration
 * @returns {string} Formatted currency string
 */
export function formatSchoolCurrency(amount, school = {}) {
  const currency = getSchoolCurrency(school);
  return formatCurrencyValue(amount, currency);
}
