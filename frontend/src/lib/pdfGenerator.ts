import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Fix: use space as thousands separator, not locale-specific char
function fmt(n: number): string {
  const num = Number(n) || 0;
  return num.toLocaleString('fr-FR').replace(/\u202f/g, ' ').replace(/,/g, '.') + ' DZD';
}

function tLabel(type: string) {
  return type === 'facture' ? 'FACTURE' : type === 'proforma' ? 'PROFORMA' : 'BON DE LIVRAISON';
}

function fDate(d: any) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Add logo to doc — handles base64 string or URL path
function addLogo(doc: jsPDF, company: any, x: number, y: number, w: number, h: number) {
  const src = company?.logo || company?.logoUrl;
  if (!src) {
    // Placeholder box
    doc.setFillColor(235, 235, 235);
    doc.rect(x, y, w, h, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(170, 170, 170);
    doc.setFont('helvetica', 'normal');
    doc.text('LOGO', x + w / 2, y + h / 2 + 2, { align: 'center' });
    return;
  }
  try {
    let imgData = src;
    // Detect format
    const fmt2 = src.startsWith('data:image/png') ? 'PNG'
      : src.startsWith('data:image/webp') ? 'WEBP'
      : 'JPEG';
    doc.addImage(imgData, fmt2, x, y, w, h);
  } catch {
    // Fallback placeholder if image fails
    doc.setFillColor(235, 235, 235);
    doc.rect(x, y, w, h, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(160, 160, 160);
    doc.text('LOGO', x + w / 2, y + h / 2 + 2, { align: 'center' });
  }
}

// Company info block helper
function companyBlock(doc: jsPDF, company: any, x: number, y: number, align: 'left' | 'right' = 'left') {
  const ax = align === 'right' ? x : x;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(10, 10, 10);
  doc.text(company?.name || 'Mon Entreprise', ax, y, { align });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  let cy = y + 5;
  if (company?.address) { doc.text(company.address, ax, cy, { align }); cy += 4; }
  if (company?.phone)   { doc.text(`Tél : ${company.phone}`, ax, cy, { align }); cy += 4; }
  if (company?.email)   { doc.text(company.email, ax, cy, { align }); cy += 4; }
  if (company?.nif)     { doc.text(`NIF : ${company.nif}`, ax, cy, { align }); cy += 4; }
  if (company?.nis)     { doc.text(`NIS : ${company.nis}`, ax, cy, { align }); cy += 4; }
  if (company?.rc)      { doc.text(`RC : ${company.rc}`, ax, cy, { align }); cy += 4; }
  if (company?.rib)     { doc.text(`RIB : ${company.rib}${company.bank ? ' — ' + company.bank : ''}`, ax, cy, { align }); cy += 4; }
  return cy;
}

// Client block helper
function clientBlock(doc: jsPDF, invoice: any, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('FACTURER À :', x, y);
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
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 18 }, 2: { cellWidth: 38 }, 3: { cellWidth: 38 } },
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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('Sous-total HT :', labelX, ty);
  doc.text(fmt(invoice.subtotal), valX, ty, { align: 'right' });

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

  return ty + 11;
}

// Footer block
function footerBlock(doc: jsPDF, invoice: any, company: any) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Notes
  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`Note : ${invoice.notes}`, 14, H - 30, { maxWidth: W - 28 });
  }

  // Signature / stamp area
  const sigY = H - 38;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  if (company?.signature || company?.stamp) {
    doc.text('Signature & Cachet', W - 55, sigY);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(W - 56, sigY + 2, 42, 16);
    const sigSrc = company.signature || company.stamp;
    try { doc.addImage(sigSrc, 'JPEG', W - 54, sigY + 3, 38, 14); } catch {}
  }

  // Footer line
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(14, H - 18, W - 14, H - 18);

  // Legal mentions
  // Legal mentions (GRAS + PRO)
doc.setFont('helvetica', 'bold'); // ✅ gras
doc.setFontSize(7); // un peu plus lisible
doc.setTextColor(100, 100, 100);

const footerText = company?.legalMentions
  || [company?.nif && `NIF : ${company.nif}`, company?.nis && `NIS : ${company.nis}`, company?.rc && `RC : ${company.rc}`]
      .filter(Boolean)
      .join('\n')
  || '';

if (footerText) {
  const lines = footerText.split('\n');

  lines.forEach((line: string, i: number) => {
    doc.text(line, W / 2, H - 12 + (i * 4), {
      align: 'center',
      maxWidth: W - 40,
    });
  });
}
}

// ─── TEMPLATE 1: CLASSIC ─────────────────────────────────────────────────────
function renderClassic(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  // Logo top-left
  addLogo(doc, company, 14, 10, 32, 22);

  // Company top-right
  companyBlock(doc, company, W - 14, 14, 'right');

  // Bold separator
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.8);
  doc.line(14, 36, W - 14, 36);

  // Document type badge
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, 40, 70, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(tLabel(invoice.type), 49, 47, { align: 'center' });

  // Document number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`N° ${invoice.number}`, 14, 60);

  // Dates right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text(`Date d'émission : ${fDate(invoice.createdAt)}`, W - 14, 52, { align: 'right' });
  if (invoice.dueDate) doc.text(`Date d'échéance : ${fDate(invoice.dueDate)}`, W - 14, 58, { align: 'right' });
  if (invoice.deliveryDate) doc.text(`Date de livraison : ${fDate(invoice.deliveryDate)}`, W - 14, 64, { align: 'right' });

  // Light separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 67, W - 14, 67);

  // Client block
  clientBlock(doc, invoice, 14, 73);

  return itemsTable(doc, invoice, 108, [225, 225, 225], [20, 20, 20]);
}

// ─── TEMPLATE 2: COMPACT ─────────────────────────────────────────────────────
function renderCompact(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  // Dark top strip
  doc.setFillColor(35, 35, 35);
  doc.rect(0, 0, W, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(company?.name || 'Mon Entreprise', 14, 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 200, 200);
  const compInfo = [company?.phone, company?.email, company?.nif && `NIF: ${company.nif}`].filter(Boolean).join('  ·  ');
  doc.text(compInfo, W / 2, 10.5, { align: 'center' });
  doc.text(fDate(invoice.createdAt), W - 14, 10.5, { align: 'right' });

  // Logo small top-right
  addLogo(doc, company, W - 14 - 18, 0, 18, 16);

  // Title row
  doc.setFillColor(250, 250, 250);
  doc.rect(0, 16, W, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(10, 10, 10);
  doc.text(`${tLabel(invoice.type)} — ${invoice.number}`, 14, 25.5);
  if (invoice.dueDate) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`Échéance : ${fDate(invoice.dueDate)}`, W - 14, 25.5, { align: 'right' });
  }

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(0, 30, W, 30);

  // Client inline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('CLIENT :', 14, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 10, 10);
  doc.text(invoice.clientName || '', 36, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const clientMeta = [invoice.clientAddress, invoice.clientPhone, invoice.clientNif && `NIF: ${invoice.clientNif}`].filter(Boolean).join('  ·  ');
  if (clientMeta) doc.text(clientMeta, 14, 44);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(14, 48, W - 14, 48);

  return itemsTable(doc, invoice, 52, [50, 50, 50], [255, 255, 255]);
}

// ─── TEMPLATE 3: DETAILED ─────────────────────────────────────────────────────
function renderDetailed(doc: jsPDF, invoice: any, company: any): number {
  const W = doc.internal.pageSize.getWidth();

  // Header: logo left, title center, date right
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

  // Divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.line(14, 32, W - 14, 32);

  // Two-column: company | client
  const colW = (W - 28 - 6) / 2;
  // Company box
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(14, 36, colW, 44);
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 36, colW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('ÉMETTEUR', 14 + colW / 2, 41, { align: 'center' });
  companyBlock(doc, company, 18, 50, 'left');

  // Client box
  const cx2 = 14 + colW + 6;
  doc.rect(cx2, 36, colW, 44);
  doc.setFillColor(245, 245, 245);
  doc.rect(cx2, 36, colW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('DESTINATAIRE', cx2 + colW / 2, 41, { align: 'center' });
  clientBlock(doc, invoice, cx2 + 4, 50);

  // Reference row
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

  // Full-width dark banner
  doc.setFillColor(18, 18, 18);
  doc.rect(0, 0, W, 32, 'F');

  // Logo centered in banner
  addLogo(doc, company, W / 2 - 16, 4, 32, 22);

  // Company name below banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 10, 10);
  doc.text((company?.name || 'Mon Entreprise').toUpperCase(), W / 2, 40, { align: 'center' });

  // Sub-info line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const info = [company?.phone, company?.email, company?.address].filter(Boolean).join('   ·   ');
  doc.text(info, W / 2, 46, { align: 'center' });

  // Legal sub-line
  const legal2 = [company?.nif && `NIF : ${company.nif}`, company?.nis && `NIS : ${company.nis}`, company?.rc && `RC : ${company.rc}`].filter(Boolean).join('   ·   ');
  if (legal2) {
    doc.setFontSize(6.5);
    doc.text(legal2, W / 2, 51, { align: 'center' });
  }

  doc.setDrawColor(18, 18, 18);
  doc.setLineWidth(1.2);
  doc.line(14, 55, W - 14, 55);
  doc.setLineWidth(0.2);
  doc.line(14, 56.5, W - 14, 56.5);

  // Document title block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(tLabel(invoice.type), W / 2, 66, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${invoice.number}`, W / 2, 73, { align: 'center' });

  // Two columns: company left, client right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('FOURNISSEUR', 14, 83);
  doc.text('CLIENT', W / 2 + 2, 83);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(14, 84.5, W / 2 - 3, 84.5);
  doc.line(W / 2 + 2, 84.5, W - 14, 84.5);

  const compEnd = companyBlock(doc, company, 14, 91, 'left');
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

  // Minimal header
  addLogo(doc, company, 14, 8, 24, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(company?.name || '', W - 14, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  if (company?.phone) doc.text(company.phone, W - 14, 17, { align: 'right' });
  if (company?.nif) doc.text(`NIF : ${company.nif}`, W - 14, 22, { align: 'right' });

  // Heavy title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(tLabel(invoice.type), 14, 38);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`N° ${invoice.number}`, 14, 45);

  // Double separator
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(2);
  doc.line(14, 50, W - 14, 50);
  doc.setLineWidth(0.4);
  doc.line(14, 52.5, W - 14, 52.5);

  // Client + dates inline
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

  // Wide table with row numbers
  const body = invoice.items.map((i: any, idx: number) => [
    { content: String(idx + 1), styles: { halign: 'center', textColor: [120, 120, 120] } },
    i.description,
    { content: String(i.quantity), styles: { halign: 'center' } },
    { content: fmt(i.unitPrice), styles: { halign: 'right' } },
    { content: fmt(i.total), styles: { halign: 'right', fontStyle: 'bold' } },
  ]);
  autoTable(doc, {
    startY: 76,
    head: [['#', 'Désignation', 'Qté', 'Prix Unitaire HT', 'Total HT']],
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, textColor: [10, 10, 10], lineColor: [210, 210, 210], lineWidth: 0.25, cellPadding: 3.5 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8.5, lineColor: [80, 80, 80], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

// ─── Main generators ──────────────────────────────────────────────────────────
export function generateInvoicePDFDoc(invoice: any, company: any): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setDrawColor(0); doc.setTextColor(0);

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

export function generateInvoicePDF(invoice: any, company: any) {
  generateInvoicePDFDoc(invoice, company).save(`${invoice.number}.pdf`);
}