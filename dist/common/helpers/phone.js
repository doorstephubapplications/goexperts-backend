export const toTenDigitPhone = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 10);
