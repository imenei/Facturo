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
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, HeadingLevel } = await import('docx');

  const isDeliveryNote = invoice.type === 'bon_livraison';
  const typeLabel = invoice.type === 'facture' ? 'FACTURE' : invoice.type === 'proforma' ? 'PROFORMA' : 'REÇU';
  // Identité société choisie pour ce document, sinon société par défaut. Le reçu reste anonyme (pas de nom).
  const displayCompanyName = isDeliveryNote ? '' : (invoice.issuerName || company?.name || 'Mon Entreprise');

  const itemRows = isDeliveryNote
    ? invoice.items.map((item: any, idx: number) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(idx + 1), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph(item.description)] }),
            new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: Number(item.unitPrice).toLocaleString('fr-DZ'), alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({ text: Number(item.total).toLocaleString('fr-DZ'), alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({ text: '☐', alignment: AlignmentType.CENTER })] }),
          ],
        }),
      )
    : invoice.items.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(item.description)], width: { size: 50, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: Number(item.unitPrice).toLocaleString('fr-DZ'), alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({ text: Number(item.total).toLocaleString('fr-DZ'), alignment: AlignmentType.RIGHT })] }),
          ],
        }),
      );

  const tableHeader = isDeliveryNote
    ? ['#', 'Désignation / Référence', 'Qté', 'Prix', 'Total', 'Reçu']
    : ['Désignation', 'Qté', 'Prix Unitaire', 'Total HT'];

  const totalQty = (invoice.items || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: displayCompanyName, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `${typeLabel} — N° ${invoice.number}`, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `Date : ${new Date(invoice.createdAt).toLocaleDateString('fr-DZ')}` }),
        ...(invoice.deliveryDate ? [new Paragraph({ text: `Date de livraison : ${new Date(invoice.deliveryDate).toLocaleDateString('fr-DZ')}` })] : []),
        new Paragraph({ text: '' }),
        new Paragraph({ text: isDeliveryNote ? 'LIVRÉ À' : 'CLIENT', heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: invoice.clientName }),
        ...(invoice.clientAddress ? [new Paragraph({ text: `Adresse : ${invoice.clientAddress}` })] : []),
        ...(invoice.clientPhone ? [new Paragraph({ text: `Tél : ${invoice.clientPhone}` })] : []),
        ...(invoice.clientEmail ? [new Paragraph({ text: `Email : ${invoice.clientEmail}` })] : []),
        ...(invoice.clientNif ? [new Paragraph({ text: `NIF : ${invoice.clientNif}` })] : []),
        new Paragraph({ text: '' }),
        new Table({
          rows: [
            new TableRow({
              tableHeader: true,
              children: tableHeader.map(
                (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })] }),
              ),
            }),
            ...itemRows,
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ text: '' }),
        ...(isDeliveryNote
          ? [
              new Paragraph({ text: `Nombre d'articles : ${invoice.items?.length || 0}` }),
              new Paragraph({ text: `Quantité totale : ${totalQty}` }),
              new Paragraph({ text: `Montant livraison : ${Number(invoice.total).toLocaleString('fr-DZ')}`, alignment: AlignmentType.RIGHT }),
              new Paragraph({ text: '' }),
              new Paragraph({ text: 'Signature expéditeur : ___________________________' }),
              new Paragraph({ text: 'Signature client (bon pour accord) : ___________________________' }),
              new Paragraph({ text: 'Date de réception : ___/___/______' }),
            ]
          : [
              new Paragraph({ text: `Sous-total HT : ${Number(invoice.subtotal).toLocaleString('fr-DZ')}`, alignment: AlignmentType.RIGHT }),
              ...(invoice.hasTva ? [new Paragraph({ text: `TVA (${invoice.tvaRate}%) : ${Number(invoice.tvaAmount).toLocaleString('fr-DZ')}`, alignment: AlignmentType.RIGHT })] : []),
              new Paragraph({ children: [new TextRun({ text: `TOTAL TTC : ${Number(invoice.total).toLocaleString('fr-DZ')}`, bold: true, size: 28 })], alignment: AlignmentType.RIGHT }),
              new Paragraph({ children: [new TextRun({ text: `Arrêtée la présente facture à la somme de : ${amountInWords(invoice.total)} dinars algériens`, italics: true, size: 18 })] }),
            ]),
        ...(invoice.notes ? [new Paragraph({ text: '' }), new Paragraph({ text: `Remarques : ${invoice.notes}` })] : []),
        ...(company?.legalMentions ? [new Paragraph({ text: '' }), new Paragraph({ text: company.legalMentions, alignment: AlignmentType.CENTER })] : []),
      ],
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
