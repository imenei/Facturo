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
