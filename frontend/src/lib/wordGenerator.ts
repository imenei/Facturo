export async function generateInvoiceWord(invoice: any, company: any) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, HeadingLevel } = await import('docx');

  const isDeliveryNote = invoice.type === 'bon_livraison';
  const typeLabel = invoice.type === 'facture' ? 'FACTURE' : invoice.type === 'proforma' ? 'PROFORMA' : 'BON DE LIVRAISON';

  const itemRows = isDeliveryNote
    ? invoice.items.map((item: any, idx: number) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(idx + 1), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph(item.description)] }),
            new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: '☐', alignment: AlignmentType.CENTER })] }),
          ],
        }),
      )
    : invoice.items.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(item.description)], width: { size: 50, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: `${Number(item.unitPrice).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({ text: `${Number(item.total).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT })] }),
          ],
        }),
      );

  const tableHeader = isDeliveryNote
    ? ['#', 'Désignation / Référence', 'Qté', 'Reçu']
    : ['Désignation', 'Qté', 'Prix Unitaire', 'Total HT'];

  const totalQty = (invoice.items || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: company?.name || 'Mon Entreprise', heading: HeadingLevel.HEADING_1 }),
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
              new Paragraph({ text: `Montant livraison : ${Number(invoice.total).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT }),
              new Paragraph({ text: '' }),
              new Paragraph({ text: 'Signature expéditeur : ___________________________' }),
              new Paragraph({ text: 'Signature client (bon pour accord) : ___________________________' }),
              new Paragraph({ text: 'Date de réception : ___/___/______' }),
            ]
          : [
              new Paragraph({ text: `Sous-total HT : ${Number(invoice.subtotal).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT }),
              ...(invoice.hasTva ? [new Paragraph({ text: `TVA (${invoice.tvaRate}%) : ${Number(invoice.tvaAmount).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT })] : []),
              new Paragraph({ children: [new TextRun({ text: `TOTAL TTC : ${Number(invoice.total).toLocaleString('fr-DZ')} DZD`, bold: true, size: 28 })], alignment: AlignmentType.RIGHT }),
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
