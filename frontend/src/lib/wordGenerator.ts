import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, BorderStyle, WidthType, HeadingLevel } from 'docx';

export async function generateInvoiceWord(invoice: any, company: any) {
  const typeLabel = invoice.type === 'facture' ? 'FACTURE' : invoice.type === 'proforma' ? 'PROFORMA' : 'BON DE LIVRAISON';

  const rows = invoice.items.map((item: any) =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(item.description)], width: { size: 50, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: `${Number(item.unitPrice).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT })] }),
        new TableCell({ children: [new Paragraph({ text: `${Number(item.total).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT })] }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: company?.name || 'Mon Entreprise', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `${typeLabel} — N° ${invoice.number}`, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `Date : ${new Date(invoice.createdAt).toLocaleDateString('fr-DZ')}` }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'CLIENT', heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: invoice.clientName }),
        ...(invoice.clientAddress ? [new Paragraph({ text: invoice.clientAddress })] : []),
        ...(invoice.clientPhone ? [new Paragraph({ text: `Tél: ${invoice.clientPhone}` })] : []),
        new Paragraph({ text: '' }),
        new Table({
          rows: [
            new TableRow({
              tableHeader: true,
              children: ['Désignation', 'Qté', 'Prix Unitaire', 'Total HT'].map(
                (h) => new TableCell({ children: [new Paragraph({ text: h, alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true })] })] })
              ),
            }),
            ...rows,
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: `Sous-total HT : ${Number(invoice.subtotal).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT }),
        ...(invoice.hasTva ? [new Paragraph({ text: `TVA (${invoice.tvaRate}%) : ${Number(invoice.tvaAmount).toLocaleString('fr-DZ')} DZD`, alignment: AlignmentType.RIGHT })] : []),
        new Paragraph({ children: [new TextRun({ text: `TOTAL TTC : ${Number(invoice.total).toLocaleString('fr-DZ')} DZD`, bold: true, size: 28 })], alignment: AlignmentType.RIGHT }),
        ...(invoice.notes ? [new Paragraph({ text: '' }), new Paragraph({ text: `Note : ${invoice.notes}` })] : []),
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
