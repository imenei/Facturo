import { adjustedUnitPrice, formatMoney, resolveInvoiceAdjustment, roundMoney } from './formatMoney';
import { breakLongWords, hexToRgb, readableTextOn } from './textUtils';

function amountInWords(n: number): string {
  return numberToFrenchWords(n);
}

function numberToFrenchWords(n: number): string {
  const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
  const twoDigits = (v: number): string => {
    if (v < 20) return UNITS[v];
    const t = Math.floor(v / 10), u = v % 10;
    if (t === 7 || t === 9) return TENS[t - 1] + '-' + (u === 1 && t === 7 ? 'et-' : '') + UNITS[10 + u];
    let word = TENS[t];
    if (u === 1 && t !== 8) word += '-et-un';
    else if (u > 0) word += '-' + UNITS[u];
    if (t === 8 && u === 0) word += 's';
    return word;
  };
  const threeDigits = (v: number): string => {
    const h = Math.floor(v / 100), r = v % 100;
    let word = '';
    if (h > 0) word += (h === 1 ? 'cent' : UNITS[h] + ' cent') + (h > 1 && r === 0 ? 's' : '');
    if (r > 0) word += (word ? ' ' : '') + twoDigits(r);
    return word;
  };
  let num = Math.floor(Math.abs(Math.round(n)));
  if (num === 0) return 'zéro';
  const groups = [
    { value: 1000000000, singular: 'milliard', plural: 'milliards' },
    { value: 1000000, singular: 'million', plural: 'millions' },
    { value: 1000, singular: 'mille', plural: 'mille' },
  ];
  let remaining = num;
  const parts: string[] = [];
  for (const g of groups) {
    const count = Math.floor(remaining / g.value);
    if (count > 0) {
      parts.push(count === 1 && g.value === 1000 ? g.singular : `${threeDigits(count)} ${count > 1 ? g.plural : g.singular}`);
      remaining -= count * g.value;
    }
  }
  if (remaining > 0) parts.push(threeDigits(remaining));
  return parts.join(' ');
}

export async function generateInvoiceWord(invoice: any, company: any) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType,
    ShadingType, BorderStyle, VerticalAlign, TableLayoutType,
  } = await import('docx');

  const isDeliveryNote = invoice.type === 'bon_livraison';
  const { type: adjustmentType, percent: adjustmentPercent } = resolveInvoiceAdjustment(invoice);

  // ── Couleur du document (réglable dans « Société ») et identité émettrice ──────────────
  const accentRgb = hexToRgb(company?.documentColor) || [20, 20, 20];
  const accent = accentRgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const onAccent = readableTextOn(accentRgb).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const companyDisplayName = (invoice.issuerName || company?.name || 'Mon Entreprise').trim();
  const nameSize = Math.min(24, Math.max(12, Number(invoice.issuerNameSize) || 16));

  // ── Mise en page A4 : largeur utile fixe pour que tous les tableaux soient alignés ─────
  const PAGE_W = 11906;
  const MARGIN = 850;
  const CW = PAGE_W - MARGIN * 2; // 10206 twips
  const FONT = 'Arial';

  const grey = { style: BorderStyle.SINGLE, size: 4, color: 'B8B8B8' } as const;
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
  const gridBorders = { top: grey, bottom: grey, left: grey, right: grey };
  const noBorders = { top: none, bottom: none, left: none, right: none };

  const run = (text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font: FONT, bold: o.bold, italics: o.italics, size: (o.size ?? 10) * 2, color: o.color });
  const para = (
    text: string,
    o: { bold?: boolean; italics?: boolean; size?: number; color?: string; align?: any; before?: number; after?: number } = {},
  ) =>
    new Paragraph({
      alignment: o.align,
      spacing: { before: o.before ?? 0, after: o.after ?? 60 },
      children: [run(text, o)],
    });
  const multiline = (text: string, o: Parameters<typeof run>[1] & { align?: any } = {}) =>
    String(text ?? '').split('\n').map((line) => para(line, { ...o, after: 0 }));

  const cell = (
    content: string | any[],
    width: number,
    o: { align?: any; bold?: boolean; fill?: string; color?: string; size?: number; borders?: any; middle?: boolean } = {},
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: o.borders ?? gridBorders,
      verticalAlign: o.middle ? VerticalAlign.CENTER : VerticalAlign.TOP,
      shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      children: typeof content === 'string'
        ? multiline(content, { bold: o.bold, color: o.color, size: o.size, align: o.align })
        : content,
    });

  const fixedTable = (widths: number[], rows: any[], align?: any) =>
    new Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      alignment: align,
      rows,
    });

  const dateFr = (value: any) => (value ? new Date(value).toLocaleDateString('fr-FR') : '');

  // ── En-tête société (même contenu que le PDF) ─────────────────────────────────────────
  const headerLines = [
    [company?.rc && `RC : ${company.rc}`, company?.nif && `NIF : ${company.nif}`].filter(Boolean).join('   '),
    company?.activities,
    [company?.phone && `Tel/Fax : ${company.phone}`, company?.mobile && `Mob : ${company.mobile}`].filter(Boolean).join('   '),
    company?.email && `Email : ${company.email}`,
    company?.address,
  ].filter(Boolean) as string[];

  const header: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [run(companyDisplayName, { bold: true, size: nameSize })],
    }),
    ...headerLines.map((line) => para(line, { size: 8, color: '464646', align: AlignmentType.CENTER, after: 0 })),
    new Paragraph({
      spacing: { before: 80, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 4 } },
      children: [],
    }),
  ];

  const body: any[] = [...header];

  if (isDeliveryNote) {
    // ═════ BON DE LIVRAISON : même contenu que le PDF — désignation / quantité / « reçu », aucun prix ═════
    body.push(
      fixedTable([CW], [new TableRow({ children: [
        cell(`BON LIVRAISON N° : ${invoice.number}`, CW, { align: AlignmentType.CENTER, bold: true, size: 13, middle: true }),
      ] })]),
      para('', { after: 120 }),
    );
    const field = (label: string, value: any) =>
      new Paragraph({ spacing: { after: 60 }, children: [run(`${label} `, { bold: true, size: 10 }), run(String(value ?? ''), { size: 10 })] });
    body.push(field('Doit à :', invoice.clientName));
    body.push(field('Adresse :', invoice.clientAddress));
    body.push(field('Date :', dateFr(invoice.createdAt)));
    if (invoice.object) body.push(field('Objet :', invoice.object));
    body.push(para('', { after: 120 }));

    const widths = [CW - 1500 - 2000, 1500, 2000];
    body.push(fixedTable(widths, [
      new TableRow({ tableHeader: true, children: [
        cell('DESIGNATION', widths[0], { bold: true, fill: 'E6E6E6', align: AlignmentType.CENTER, middle: true }),
        cell('QTE', widths[1], { bold: true, fill: 'E6E6E6', align: AlignmentType.CENTER, middle: true }),
        cell('TOTAL', widths[2], { bold: true, fill: 'E6E6E6', align: AlignmentType.CENTER, middle: true }),
      ] }),
      ...(invoice.items || []).map((item: any) => new TableRow({ cantSplit: true, children: [
        cell(breakLongWords(item.description), widths[0]),
        cell(String(item.quantity), widths[1], { align: AlignmentType.CENTER }),
        cell('reçu', widths[2], { align: AlignmentType.CENTER }),
      ] })),
    ]));
  } else {
    // ═════ FACTURE / PROFORMA ═════════════════════════════════════════════════════════════
    const typeLabel = invoice.type === 'proforma' ? 'PROFORMA' : 'FACTURE';
    body.push(
      fixedTable([CW - 2600, 2600], [new TableRow({ children: [
        cell(`${typeLabel} — N° ${invoice.number}`, CW - 2600, { bold: true, size: 12, fill: accent, color: onAccent, middle: true, borders: noBorders }),
        cell(`Date : ${dateFr(invoice.createdAt)}`, 2600, { align: AlignmentType.RIGHT, fill: accent, color: onAccent, middle: true, borders: noBorders }),
      ] })]),
      para('', { after: 100 }),
    );

    const clientLines = [
      invoice.clientName,
      invoice.clientAddress && `Adresse : ${invoice.clientAddress}`,
      invoice.clientPhone && `Tél : ${invoice.clientPhone}`,
      invoice.clientEmail && `Email : ${invoice.clientEmail}`,
      invoice.clientNif && `NIF : ${invoice.clientNif}`,
    ].filter(Boolean) as string[];
    const infoLines = [
      invoice.dueDate && `Échéance : ${dateFr(invoice.dueDate)}`,
      invoice.deliveryDate && `Livraison : ${dateFr(invoice.deliveryDate)}`,
      invoice.object && `Objet : ${invoice.object}`,
    ].filter(Boolean) as string[];
    body.push(
      fixedTable([CW / 2, CW / 2], [new TableRow({ children: [
        cell([para('CLIENT', { bold: true, size: 8, color: '666666' }), ...clientLines.map((l, i) => para(l, { bold: i === 0, after: 20 }))], CW / 2),
        cell([para('INFORMATIONS', { bold: true, size: 8, color: '666666' }), ...(infoLines.length ? infoLines : ['—']).map((l) => para(l, { after: 20 }))], CW / 2),
      ] })]),
      para('', { after: 120 }),
    );

    const widths = [CW - 1100 - 2300 - 2300, 1100, 2300, 2300];
    const head = ['Désignation', 'Qté', 'Prix Unitaire HT', 'Total HT'];
    body.push(fixedTable(widths, [
      new TableRow({ tableHeader: true, children: head.map((h, i) =>
        cell(h, widths[i], { bold: true, fill: accent, color: onAccent, align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, middle: true, size: 9 })) }),
      ...(invoice.items || []).map((item: any) => {
        const unitPrice = adjustedUnitPrice(Number(item.unitPrice), adjustmentType, adjustmentPercent);
        const total = roundMoney(unitPrice * Number(item.quantity || 0));
        return new TableRow({ cantSplit: true, children: [
          cell(breakLongWords(item.description), widths[0], { size: 9 }),
          cell(String(item.quantity), widths[1], { align: AlignmentType.CENTER, size: 9 }),
          cell(formatMoney(unitPrice), widths[2], { align: AlignmentType.RIGHT, size: 9 }),
          cell(formatMoney(total), widths[3], { align: AlignmentType.RIGHT, size: 9 }),
        ] });
      }),
    ]));

    // Totaux : tableau aligné à droite
    const charges = Array.isArray(invoice.otherCharges) ? invoice.otherCharges : [];
    const subtotal = roundMoney((invoice.items || []).reduce((sum: number, item: any) => {
      const unitPrice = adjustedUnitPrice(Number(item.unitPrice), adjustmentType, adjustmentPercent);
      return sum + roundMoney(unitPrice * Number(item.quantity || 0));
    }, 0));
    const TW = [2700, 2100];
    const totalRow = (label: string, value: string, strong = false) => new TableRow({ children: [
      cell(label, TW[0], { bold: strong, fill: strong ? accent : undefined, color: strong ? onAccent : undefined, borders: strong ? noBorders : gridBorders, middle: true }),
      cell(value, TW[1], { bold: strong, align: AlignmentType.RIGHT, fill: strong ? accent : undefined, color: strong ? onAccent : undefined, borders: strong ? noBorders : gridBorders, middle: true }),
    ] });
    body.push(
      para('', { after: 120 }),
      fixedTable(TW, [
        totalRow('Sous-total HT', formatMoney(subtotal)),
        ...charges.map((c: any) => totalRow(`Frais : ${c.description || 'Autre frais'}`, formatMoney(c.amount))),
        ...(invoice.hasTva ? [totalRow(`TVA (${invoice.tvaRate}%)`, formatMoney(invoice.tvaAmount))] : []),
        totalRow('TOTAL TTC', formatMoney(invoice.total), true),
      ], AlignmentType.RIGHT),
      new Paragraph({ spacing: { before: 120, after: 40 }, children: [run(`Arrêtée la présente ${typeLabel === 'PROFORMA' ? 'proforma' : 'facture'} à la somme de : ${amountInWords(invoice.total)} dinars algériens`, { italics: true, size: 9 })] }),
    );
    if (adjustmentType === 'discount' && adjustmentPercent > 0) {
      body.push(para(`Remise appliquée : ${adjustmentPercent}% (incluse dans les prix unitaires)`, { size: 9 }));
    }
  }

  if (invoice.notes) body.push(para(`Remarques : ${invoice.notes}`, { before: 160, size: 9 }));
  if (company?.legalMentions) body.push(para(company.legalMentions, { before: 160, size: 8, color: '555555', align: AlignmentType.CENTER }));

  const footerParts = [
    company?.nif && `NIF : ${company.nif}`,
    company?.rc && `RC : ${company.rc}`,
    company?.ai && `AI : ${company.ai}`,
    company?.rib && `RIP / RIB : ${company.rib}`,
  ].filter(Boolean) as string[];
  if (!isDeliveryNote && footerParts.length) {
    body.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 6 } },
      children: [run(footerParts.join('  ·  '), { size: 8, color: '444444' })],
    }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      children: body,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.number}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
