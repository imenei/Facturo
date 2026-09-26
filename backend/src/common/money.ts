export function roundMoney(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function formatMoney(value: number | string | null | undefined): string {
  return roundMoney(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
}

export function computeNetProfit(
  grossMargin: number,
  otherCharge = 0,
  deliveryPrice = 0,
): number {
  return roundMoney(roundMoney(grossMargin) - roundMoney(otherCharge) - roundMoney(deliveryPrice));
}

export function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(value.includes('T') ? value : `${value}T12:00:00`);
}
