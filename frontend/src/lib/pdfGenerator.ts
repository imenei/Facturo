import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { roundMoney } from './formatMoney';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'https://api.helpdz.com';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveLogoSrc(company: any): string | null {
  const raw = company?.logo || company?.logoUrl;
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('http')) return raw;
  return `${API_BASE}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

async function logoToBase64(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Prépare logo (base64) et nom entreprise avant génération PDF */
export async function prepareCompanyForPdf(company: any): Promise<any> {
  if (!company) return { name: 'Mon Entreprise' };
  const prepared = { ...company, name: (company.name || '').trim() || 'Mon Entreprise' };
  const src = resolveLogoSrc(company);
  if (!src) return prepared;
  if (src.startsWith('data:')) {
    prepared._pdfLogo = src;
    return prepared;
  }
  const b64 = await logoToBase64(src);
  if (b64) prepared._pdfLogo = b64;
  return prepared;
}

function companyName(company: any): string {
  return (company?.name || '').trim() || 'Mon Entreprise';
}

function fmt(n: number): string {
  const num = Math.round((Number(n) || 0) * 100) / 100;
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
}

function companyNameSize(invoice: any): number {
  const n = Number(invoice?.issuerNameSize);
  if (!Number.isFinite(n)) return 16;
  return Math.min(24, Math.max(12, n));
}

// ─── Nombre en lettres (DZD) ────────────────────────────────────────────────
const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7 || t === 9) {
    return TENS[t - 1] + '-' + (u === 1 && t === 7 ? 'et-' : '') + UNITS[10 + u];
  }
  let word = TENS[t];
  if (u === 1 && t !== 8) word += '-et-un';
  else if (u > 0) word += '-' + UNITS[u];
  if (t === 8 && u === 0) word += 's';
  return word;
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  let word = '';
  if (h > 0) word += (h === 1 ? 'cent' : UNITS[h] + ' cent') + (h > 1 && r === 0 ? 's' : '');
  if (r > 0) word += (word ? ' ' : '') + twoDigitsToWords(r);
  return word;
}

function numberToFrenchWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zéro';
  const groups = [
    { value: 1000000000, singular: 'milliard', plural: 'milliards' },
    { value: 1000000, singular: 'million', plural: 'millions' },
    { value: 1000, singular: 'mille', plural: 'mille' },
  ];
  let remaining = n;
  let parts: string[] = [];
  for (const g of groups) {
    const count = Math.floor(remaining / g.value);
    if (count > 0) {
      const label = count === 1 && g.value === 1000 ? g.singular : `${threeDigitsToWords(count)} ${count > 1 ? g.plural : g.singular}`;
      parts.push(label);
      remaining -= count * g.value;
    }
  }
  if (remaining > 0) parts.push(threeDigitsToWords(remaining));
  return parts.join(' ');
}

function amountInWords(n: number): string {
  const num = Math.round(Number(n) || 0);
  return `Arrêtée la présente facture à la somme de : ${numberToFrenchWords(num)} dinars algériens`.replace(/\s+/g, ' ');
}

function tLabel(type: string) {
  return type === 'facture' ? 'FACTURE' : type === 'proforma' ? 'PROFORMA' : 'REÇU';
}

function fDate(d: any) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function addLogo(doc: jsPDF, company: any, x: number, y: number, w: number, h: number) {
  const src = company?._pdfLogo || resolveLogoSrc(company);
  if (src) {
    try {
      const fmt2 = src.startsWith('data:image/png') ? 'PNG'
        : src.startsWith('data:image/webp') ? 'WEBP'
        : 'JPEG';
      doc.addImage(src, fmt2, x, y, w, h);
      return;
    } catch {
      // fallback texte ci-dessous
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.min(11, w / 3));
  doc.setTextColor(10, 10, 10);
  doc.text(companyName(company), x, y + h * 0.45, { maxWidth: w });
}

// Company info block helper
function companyBlock(doc: jsPDF, company: any, invoice: any, x: number, y: number, align: 'left' | 'right' = 'left') {
  const ax = align === 'right' ? x : x;
  const maxWidth = align === 'right' ? 128 : 82;
  const size = companyNameSize(invoice);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  const nameLines = doc.splitTextToSize(companyName(company), maxWidth);
  doc.setTextColor(10, 10, 10);
  doc.text(nameLines, ax, y, { align });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  let cy = y + Math.max(6, size * 0.38) + 2 + Math.max(0, nameLines.length - 1) * 4;
  const contactLines = [company?.address, company?.phone && `Tél : ${company.phone}`, company?.email].filter(Boolean);
  for (const line of contactLines) {
    const lines = doc.splitTextToSize(String(line), maxWidth);
    doc.text(lines, ax, cy, { align });
    cy += Math.max(4, lines.length * 3.5);
  }
  return cy;
}

// Client block helper
function clientBlock(doc: jsPDF, invoice: any, x: number, y: number, label = 'FACTURER À :') {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(10, 10, 10);
  doc.text(invoice.clientName || '', x, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  let cy = y + 11;
  if (invoice.clientAddress) { doc.text(invoice.clientAddress, x, cy); cy += 4; }
  if (invoice.clientPhone)   { doc.text(`Tél : ${invoice.clientPhone}`, x, cy); cy += 4; }
  if (invoice.clientEmail)   { doc.text(invoice.clientEmail, x, cy); cy += 4; }
  if (invoice.clientNif)     { doc.text(`NIF : ${invoice.clientNif}`, x, cy); cy += 4; }
  if (invoice.clientNis)     { doc.text(`NIS : ${invoice.clientNis}`, x, cy); cy += 4; }
  return cy;
}

// Items table helper
function itemsTable(doc: jsPDF, invoice: any, startY: number, headFill: number[], headText: number[]) {
  const body = invoice.items.map((i: any) => [
    i.description,
    { content: String(i.quantity), styles: { halign: 'center' } },
    { content: fmt(i.unitPrice), styles: { halign: 'right' } },
    { content: fmt(i.total), styles: { halign: 'right' } },
  ]);
  autoTable(doc, {
    startY,
    head: [['Désignation', 'Qté', 'Prix Unitaire HT', 'Total HT']],
    body,
    theme: 'grid',
    styles: { fontSize: 8, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.2, cellPadding: 3 },
    headStyles: { fillColor: headFill as any, textColor: headText as any, fontStyle: 'bold', fontSize: 8, cellPadding: 3.5 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 18 }, 2: { cellWidth: 38, fontSize: 7 }, 3: { cellWidth: 38, fontSize: 7 } },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

// Totals block
function totalsBlock(doc: jsPDF, invoice: any, y: number) {
  const W = doc.internal.pageSize.getWidth();
  let ty = y + 8;
  const labelX = W - 70;
  const valX = W - 14;
  const invoiceCharges = Array.isArray(invoice.otherCharges) ? invoice.otherCharges : [];
  const chargesTotal = invoiceCharges.reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0);
  const subtotalBeforeDiscount = roundMoney(Number(invoice.subtotal || 0) - chargesTotal);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('Sous-total HT :', labelX, ty);
  doc.text(fmt(subtotalBeforeDiscount), valX, ty, { align: 'right' });

  for (const charge of invoiceCharges) {
    ty += 6;
    doc.text(`Frais : ${charge.description || 'Autre frais'}`, labelX, ty, { maxWidth: 50 });
    doc.text(fmt(charge.amount), valX, ty, { align: 'right' });
  }

  if (invoice.hasTva) {
    ty += 6;
    doc.text(`TVA (${invoice.tvaRate}%) :`, labelX, ty);
    doc.text(fmt(invoice.tvaAmount), valX, ty, { align: 'right' });
  }

  ty += 3;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(labelX - 2, ty, W - 14, ty);

  ty += 2;
  doc.setFillColor(20, 20, 20);
  doc.rect(labelX - 4, ty, W - 14 - (labelX - 4), 11, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TTC :', labelX, ty + 7.5);
  doc.text(fmt(invoice.total), valX, ty + 7.5, { align: 'right' });

  ty += 11;

  // Montant en lettres sous le TTC
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const words = amountInWords(invoice.total);
  const wrapped = doc.splitTextToSize(words, W - 28);
  doc.text(wrapped, 14, ty + 6);
  ty += 6 + wrapped.length * 3.6;

  return ty;
}

// Footer block
function footerBlock(doc: jsPDF, invoice: any, company: any) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`Note : ${invoice.notes}`, 14, H - 30, { maxWidth: W - 28 });
  }

  const sigY = H - 38;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  if (company?.signature || company?.stamp) {
    doc.text('Signature et cachet', W - 55, sigY);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(W - 56, sigY + 2, 42, 16);
    const sigSrc = company.signature || company.stamp;
    try { doc.addImage(sigSrc, 'JPEG', W - 54, sigY + 3, 38, 14); } catch {}
  }

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(14, H - 18, W - 14, H - 18);

  // ✅ FIX: mentions légales seulement si company existe et footerText non vide
  if (company) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);

    const legalLines = [
      company?.legalMentions,
      [company?.nif && `NIF : ${company.nif}`, company?.nis && `NIS : ${company.nis}`].filter(Boolean).join(' · '),
      [company?.rc && `RC : ${company.rc}`, company?.ai && `AI : ${company.ai}`, company?.rib && `RIP / RIB : ${company.rib}${company.bank ? ` — ${company.bank}` : ''}`].filter(Boolean).join(' · '),
    ].filter(Boolean).flatMap((line: string) => doc.splitTextToSize(String(line), W - 28));
    if (legalLines.length) {
      legalLines.forEach((line: string, i: number) => {
        doc.text(line, W / 2, H - 13 + (i * 3), { align: 'center', maxWidth: W - 28 });
      });
    }
  }
}

// ─── TEMPLATE 1: CLASSIC ─────────────────────────────────────────────────────
function renderClassic(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  addLogo(doc, company, 14, 10, 32, 22);
  companyBlock(doc, company, invoice, W - 14, 14, 'right');

  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.8);
  doc.line(14, 36, W - 14, 36);

  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, 40, 70, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(tLabel(invoice.type), 49, 47, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`N° ${invoice.number}`, 14, 60);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text(`Date d'émission : ${fDate(invoice.createdAt)}`, W - 14, 52, { align: 'right' });
  if (invoice.dueDate) doc.text(`Date d'échéance : ${fDate(invoice.dueDate)}`, W - 14, 58, { align: 'right' });
  if (invoice.deliveryDate) doc.text(`Date de livraison : ${fDate(invoice.deliveryDate)}`, W - 14, 64, { align: 'right' });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 67, W - 14, 67);

  clientBlock(doc, invoice, 14, 73);

  return itemsTable(doc, invoice, 108, [225, 225, 225], [20, 20, 20]);
}

// ─── TEMPLATE 2: COMPACT ─────────────────────────────────────────────────────
function renderCompact(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(35, 35, 35);
  doc.rect(0, 0, W, 30, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(companyNameSize(invoice));
  doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(companyName(company), 78), 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  let infoY = 7;
  for (const line of [company?.address, company?.phone, company?.email].filter(Boolean)) {
    const lines = doc.splitTextToSize(String(line), 68);
    doc.text(lines, W - 42, infoY, { align: 'right' });
    infoY += Math.max(3.5, lines.length * 3.2);
  }
  doc.text(fDate(invoice.createdAt), W - 42, 26, { align: 'right' });

  addLogo(doc, company, W - 14 - 18, 0, 18, 24);

  doc.setFillColor(250, 250, 250);
  doc.rect(0, 30, W, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(10, 10, 10);
  doc.text(`${tLabel(invoice.type)} — ${invoice.number}`, 14, 39.5);
  if (invoice.dueDate) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`Échéance : ${fDate(invoice.dueDate)}`, W - 14, 39.5, { align: 'right' });
  }

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(0, 44, W, 44);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('CLIENT :', 14, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 10, 10);
  doc.text(invoice.clientName || '', 36, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const clientMeta = [invoice.clientAddress, invoice.clientPhone, invoice.clientNif && `NIF: ${invoice.clientNif}`].filter(Boolean).join('  ·  ');
  if (clientMeta) doc.text(clientMeta, 14, 58);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(14, 62, W - 14, 62);

  return itemsTable(doc, invoice, 66, [50, 50, 50], [255, 255, 255]);
}

// ─── TEMPLATE 3: DETAILED ─────────────────────────────────────────────────────
function renderDetailed(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  addLogo(doc, company, 14, 8, 28, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(tLabel(invoice.type), W / 2, 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${invoice.number}`, W / 2, 22, { align: 'center' });
  doc.text(fDate(invoice.createdAt), W - 14, 14, { align: 'right' });
  if (invoice.dueDate) doc.text(`Éch. : ${fDate(invoice.dueDate)}`, W - 14, 19, { align: 'right' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.line(14, 32, W - 14, 32);

  const colW = (W - 28 - 6) / 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(14, 36, colW, 44);
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 36, colW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('ÉMETTEUR', 14 + colW / 2, 41, { align: 'center' });
  companyBlock(doc, company, invoice, 18, 50, 'left');

  const cx2 = 14 + colW + 6;
  doc.rect(cx2, 36, colW, 44);
  doc.setFillColor(245, 245, 245);
  doc.rect(cx2, 36, colW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('DESTINATAIRE', cx2 + colW / 2, 41, { align: 'center' });
  clientBlock(doc, invoice, cx2 + 4, 50);

  doc.setFillColor(248, 248, 248);
  doc.rect(14, 84, W - 28, 12, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.rect(14, 84, W - 28, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Émission : ${fDate(invoice.createdAt)}`, 18, 91);
  if (invoice.dueDate) doc.text(`Échéance : ${fDate(invoice.dueDate)}`, 80, 91);
  if (invoice.deliveryDate) doc.text(`Livraison : ${fDate(invoice.deliveryDate)}`, 145, 91);

  return itemsTable(doc, invoice, 100, [230, 230, 230], [20, 20, 20]);
}

// ─── TEMPLATE 4: CORPORATE ───────────────────────────────────────────────────
function renderCorporate(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(18, 18, 18);
  doc.rect(0, 0, W, 32, 'F');

  addLogo(doc, company, W / 2 - 16, 4, 32, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(companyNameSize(invoice));
  doc.setTextColor(10, 10, 10);
  doc.text(doc.splitTextToSize(companyName(company).toUpperCase(), W - 36), W / 2, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const info = [company?.phone, company?.email, company?.address].filter(Boolean).join('   ·   ');
  doc.text(info, W / 2, 49, { align: 'center', maxWidth: W - 28 });

  doc.setDrawColor(18, 18, 18);
  doc.setLineWidth(1.2);
  doc.line(14, 55, W - 14, 55);
  doc.setLineWidth(0.2);
  doc.line(14, 56.5, W - 14, 56.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(tLabel(invoice.type), W / 2, 66, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${invoice.number}`, W / 2, 73, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('FOURNISSEUR', 14, 83);
  doc.text('CLIENT', W / 2 + 2, 83);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(14, 84.5, W / 2 - 3, 84.5);
  doc.line(W / 2 + 2, 84.5, W - 14, 84.5);

  const compEnd = companyBlock(doc, company, invoice, 14, 91, 'left');
  const clientEnd = clientBlock(doc, invoice, W / 2 + 2, 88);

  const refY = Math.max(compEnd, clientEnd) + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text(`Date : ${fDate(invoice.createdAt)}`, 14, refY);
  if (invoice.dueDate) doc.text(`Échéance : ${fDate(invoice.dueDate)}`, 70, refY);

  return itemsTable(doc, invoice, refY + 8, [22, 22, 22], [255, 255, 255]);
}

// ─── TEMPLATE 5: TABLE_FOCUS ─────────────────────────────────────────────────
function renderTableFocus(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  addLogo(doc, company, 14, 8, 24, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(companyNameSize(invoice));
  doc.setTextColor(80, 80, 80);
  doc.text(doc.splitTextToSize(companyName(company), 96), W - 14, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  const contactInfo = [company?.address, company?.phone, company?.email].filter(Boolean).join(' · ');
  if (contactInfo) doc.text(doc.splitTextToSize(contactInfo, 96), W - 14, 19, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(tLabel(invoice.type), 14, 38);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`N° ${invoice.number}`, 14, 45);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(2);
  doc.line(14, 50, W - 14, 50);
  doc.setLineWidth(0.4);
  doc.line(14, 52.5, W - 14, 52.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(10, 10, 10);
  doc.text(invoice.clientName || '', 14, 61);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  const clientInfo = [invoice.clientAddress, invoice.clientPhone].filter(Boolean).join('  ·  ');
  if (clientInfo) doc.text(clientInfo, 14, 67);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date : ${fDate(invoice.createdAt)}`, W - 14, 59, { align: 'right' });
  if (invoice.dueDate) doc.text(`Échéance : ${fDate(invoice.dueDate)}`, W - 14, 65, { align: 'right' });
  if (invoice.deliveryDate) doc.text(`Livraison : ${fDate(invoice.deliveryDate)}`, W - 14, 71, { align: 'right' });

  const body = invoice.items.map((i: any) => [
    i.description,
    { content: String(i.quantity), styles: { halign: 'center' } },
    { content: fmt(i.unitPrice), styles: { halign: 'right' } },
    { content: fmt(i.total), styles: { halign: 'right', fontStyle: 'bold' } },
  ]);
  autoTable(doc, {
    startY: 76,
    head: [['Désignation', 'Qté', 'Prix Unitaire HT', 'Total HT']],
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, textColor: [10, 10, 10], lineColor: [210, 210, 210], lineWidth: 0.25, cellPadding: 3.5 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8.5, lineColor: [80, 80, 80], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 38, halign: 'right', fontSize: 7 },
      3: { cellWidth: 38, halign: 'right', fontSize: 7 },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

// ─── BON DE LIVRAISON (modèle LMCompany) ─────────────────────────────────────
function renderDeliveryNote(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();
  const CW = W - 28;
  let y = 14;

  // EN-TÊTE SOCIÉTÉ
  const hasLogo = Boolean(company?._pdfLogo);
  if (hasLogo) addLogo(doc, company, 14, 8, 26, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(companyNameSize(invoice));
  doc.setTextColor(10, 10, 10);
  const nameLines = doc.splitTextToSize(companyName(company), hasLogo ? CW - 60 : CW);
  doc.text(nameLines, W / 2, y, { align: 'center' });
  y += nameLines.length * 6 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  const headerLines = [
    [company?.rc && `RC : ${company.rc}`, company?.nif && `NIF : ${company.nif}`].filter(Boolean).join('   '),
    company?.activities,
    [company?.phone && `Tel/Fax : ${company.phone}`, company?.mobile && `Mob : ${company.mobile}`].filter(Boolean).join('   '),
    company?.email && `Email : ${company.email}`,
    company?.address,
  ].filter(Boolean) as string[];
  for (const line of headerLines) {
    for (const l of doc.splitTextToSize(line, CW - (hasLogo ? 60 : 0))) {
      doc.text(l, W / 2, y, { align: 'center' });
      y += 3.8;
    }
  }

  y = Math.max(y, hasLogo ? 30 : 0) + 2;
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.6);
  doc.line(14, y, W - 14, y);
  y += 10;

  // TITRE
  doc.setLineWidth(0.4);
  doc.rect(14, y - 7, CW, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(`BON LIVRAISON N° : ${invoice.number}`, W / 2, y, { align: 'center' });
  y += 14;

  // INFOS CLIENT
  const field = (label: string, value: string, x: number, yy: number, maxW: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(10, 10, 10);
    doc.text(label, x, yy);
    const lw = doc.getTextWidth(label) + 2;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(value || ''), maxW - lw);
    doc.text(lines, x + lw, yy);
    return Math.max(1, lines.length);
  };

  field('Doit à :', invoice.clientName, 14, y, CW);
  y += 6;
  const nAddr = field('Adresse :', invoice.clientAddress, 14, y, 125);
  field('Date :', fDate(invoice.createdAt), 145, y, W - 14 - 145);
  y += 5 * nAddr + 1;

  if (invoice.object) {
    const nObj = field('Objet :', invoice.object, 14, y, CW);
    y += 5 * nObj + 1;
  }
  y += 5;

  // TABLEAU : DESIGNATION / QTE / TOTAL ("reçu")
  const body = (invoice.items || []).map((i: any) => [
    i.description,
    { content: String(i.quantity), styles: { halign: 'center' } },
    { content: 'reçu', styles: { halign: 'center' } },
  ]);
  autoTable(doc, {
    startY: y,
    head: [['DESIGNATION', 'QTE', 'TOTAL']],
    body,
    theme: 'grid',
    styles: { fontSize: 9.5, textColor: [20, 20, 20], lineColor: [60, 60, 60], lineWidth: 0.3, cellPadding: 3 },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 25 }, 2: { cellWidth: 35 } },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

// ─── Main generators ──────────────────────────────────────────────────────────
export function generateInvoicePDFDoc(invoice: any, company: any): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setDrawColor(0); doc.setTextColor(0);

  // Si une identité société a été choisie pour ce document (invoice.issuerName),
  // elle remplace le nom de la société par défaut sur le document généré.
  company = { ...company, ...(invoice.issuerName ? { name: invoice.issuerName } : {}), _nameSize: invoice.issuerNameSize };

  if (invoice.type === 'bon_livraison') {
    renderDeliveryNote(doc, invoice, company);
    return doc;
  }

  let finalY = 0;
  switch (invoice.templateType || 'classic') {
    case 'compact':     finalY = renderCompact(doc, invoice, company); break;
    case 'detailed':    finalY = renderDetailed(doc, invoice, company); break;
    case 'corporate':   finalY = renderCorporate(doc, invoice, company); break;
    case 'table_focus': finalY = renderTableFocus(doc, invoice, company); break;
    default:            finalY = renderClassic(doc, invoice, company); break;
  }
  totalsBlock(doc, invoice, finalY);
  footerBlock(doc, invoice, company);
  return doc;
}

export async function generateInvoicePDF(invoice: any, company: any) {
  const prepared = await prepareCompanyForPdf(company);
  generateInvoicePDFDoc(invoice, prepared).save(`${invoice.number}.pdf`);
}
