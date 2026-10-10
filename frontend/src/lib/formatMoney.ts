/** Arrondi monétaire (2 décimales) — à n'utiliser que pour l'affichage et les totaux calculés. */
export function roundMoney(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Format d'affichage FR : 1500 → "1 500,00"
 * Ne pas stocker ce résultat en base.
 */
export function formatMoney(value: number | string | null | undefined): string {
  return roundMoney(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
}

export function formatMoneyDzd(value: number | string | null | undefined): string {
  return `${formatMoney(value)} DZD`;
}

/** Marge brute ligne : (vente - achat) × qté */
export function lineGrossMargin(unitPrice: number, purchasePrice: number, quantity: number): number {
  return roundMoney((roundMoney(unitPrice) - roundMoney(purchasePrice)) * Number(quantity || 0));
}

export function adjustedUnitPrice(unitPrice: number, adjustmentType: string, percent: number): number {
  const normalizedPercent = Math.min(Math.max(Number(percent) || 0, 0), 100);
  const basePrice = roundMoney(unitPrice);
  const unitAdjustment = roundMoney((basePrice * normalizedPercent) / 100);
  return roundMoney(basePrice + (adjustmentType === 'addition' ? unitAdjustment : -unitAdjustment));
}

export function lineAdjustmentAmount(unitPrice: number, quantity: number, adjustmentType: string, percent: number): number {
  const baseTotal = roundMoney(roundMoney(unitPrice) * Number(quantity || 0));
  const adjustedTotal = roundMoney(adjustedUnitPrice(unitPrice, adjustmentType, percent) * Number(quantity || 0));
  return roundMoney(Math.abs(adjustedTotal - baseTotal));
}

export function resolveInvoiceAdjustment(invoice: any): { type: string; percent: number; amount: number } {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const baseSubtotal = roundMoney(items.reduce(
    (sum: number, item: any) => sum + roundMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0)),
    0,
  ));
  const charges = roundMoney((invoice?.otherCharges || []).reduce(
    (sum: number, charge: any) => sum + Number(charge.amount || 0),
    0,
  ));
  const subtotalDelta = roundMoney(Number(invoice?.subtotal || 0) - baseSubtotal - charges);
  const amount = roundMoney(
    Number(invoice?.adjustmentAmount || invoice?.discountAmount || Math.abs(subtotalDelta)),
  );
  const type = invoice?.adjustmentType === 'addition' || invoice?.adjustmentType === 'discount'
    ? invoice.adjustmentType
    : Number(invoice?.discountAmount || invoice?.discountPercent || 0) > 0 || subtotalDelta < 0
      ? 'discount'
      : 'addition';
  const percent = Number(invoice?.adjustmentPercent || invoice?.discountPercent || 0)
    || (baseSubtotal > 0 ? roundMoney((amount / baseSubtotal) * 100) : 0);

  return { type, percent, amount };
}

/**
 * Bénéfice net unique pour toute l'app.
 * Ne déduit pas deux fois : otherCharge et deliveryPrice sont des champs distincts.
 */
export function computeNetProfit(
  grossMargin: number,
  otherCharge = 0,
  deliveryPrice = 0,
): number {
  return roundMoney(roundMoney(grossMargin) - roundMoney(otherCharge) - roundMoney(deliveryPrice));
}
