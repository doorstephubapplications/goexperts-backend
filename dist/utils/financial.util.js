export const GST_RATE_FOR_INCLUDED_PLAN_PRICE = 0.18;
/**
 * Calculates canonical reverse-tax breakdown for GST-inclusive prices at statutory 18% rate.
 *
 * Formula:
 *   subtotal = roundCurrency(total / (1 + GST_RATE))
 *   gst = roundCurrency(total - subtotal)
 *
 * Strict Accounting Invariants:
 *   subtotal + gst === total (exact two-decimal parity)
 *   subtotal >= 0, gst >= 0 for all non-negative gross amounts
 */
export const calculateInclusiveGst = (grossAmount, taxRate = GST_RATE_FOR_INCLUDED_PLAN_PRICE) => {
    const total = parseFloat(Number(grossAmount || 0).toFixed(2));
    if (!Number.isFinite(total) || total <= 0) {
        return { subtotal: 0, gst: 0, total: 0 };
    }
    const subtotal = parseFloat((total / (1 + taxRate)).toFixed(2));
    const gst = parseFloat((total - subtotal).toFixed(2));
    return { subtotal, gst, total };
};
export const getPlanBaseAmountExcludingGst = (amountIncludingGst) => {
    return calculateInclusiveGst(amountIncludingGst).subtotal;
};
