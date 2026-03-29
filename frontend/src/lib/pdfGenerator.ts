import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateInvoicePDF(invoice: any, company: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(26, 84, 255);
  doc.rect(0, 0, pageW, 40, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(company?.name || 'Mon Entreprise', 15, 18);

  // Document type
  const typeLabel = invoice.type === 'facture' ? 'FACTURE' : invoice.type === 'proforma' ? 'PROFORMA' : 'BON DE LIVRAISON';
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(typeLabel, 15, 28);
  doc.text(`N° ${invoice.number}`, pageW - 15, 28, { align: 'right' });

  // Company info (left)
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  let y = 50;
  if (company?.address) { doc.text(company.address, 15, y); y += 5; }
  if (company?.phone) { doc.text(`Tél: ${company.phone}`, 15, y); y += 5; }
  if (company?.email) { doc.text(`Email: ${company.email}`, 15, y); y += 5; }
  if (company?.nif) { doc.text(`NIF: ${company.nif}`, 15, y); y += 5; }
  if (company?.nis) { doc.text(`NIS: ${company.nis}`, 15, y); y += 5; }
  if (company?.rc) { doc.text(`RC: ${company.rc}`, 15, y); y += 5; }

  // Client info (right)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURER À :', pageW - 85, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let yc = 56;
  doc.text(invoice.clientName, pageW - 85, yc); yc += 5;
  if (invoice.clientAddress) { doc.text(invoice.clientAddress, pageW - 85, yc); yc += 5; }
  if (invoice.clientPhone) { doc.text(`Tél: ${invoice.clientPhone}`, pageW - 85, yc); yc += 5; }
  if (invoice.clientEmail) { doc.text(invoice.clientEmail, pageW - 85, yc); yc += 5; }
  if (invoice.clientNif) { doc.text(`NIF: ${invoice.clientNif}`, pageW - 85, yc); yc += 5; }
  if (invoice.clientNis) { doc.text(`NIS: ${invoice.clientNis}`, pageW - 85, yc); yc += 5; }

  // Date
  const dateStr = new Date(invoice.createdAt).toLocaleDateString('fr-DZ');
  doc.setFontSize(9);
  doc.text(`Date: ${dateStr}`, 15, 88);
  if (invoice.dueDate) {
    doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-DZ')}`, 15, 93);
  }

  // Items table
  const tableData = invoice.items.map((item: any) => [
    item.description,
    item.quantity,
    `${Number(item.unitPrice).toLocaleString('fr-DZ')} DZD`,
    `${Number(item.total).toLocaleString('fr-DZ')} DZD`,
  ]);

  autoTable(doc, {
    startY: 98,
    head: [['Désignation', 'Qté', 'Prix Unitaire', 'Total HT']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [26, 84, 255], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 85 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Totals box
  const boxX = pageW - 80;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);

  const addTotal = (label: string, value: string, yPos: number, bold = false) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, boxX, yPos);
    doc.text(value, pageW - 15, yPos, { align: 'right' });
  };

  let ty = finalY;
  addTotal('Sous-total HT :', `${Number(invoice.subtotal).toLocaleString('fr-DZ')} DZD`, ty);
  if (invoice.hasTva) {
    ty += 7;
    addTotal(`TVA (${invoice.tvaRate}%) :`, `${Number(invoice.tvaAmount).toLocaleString('fr-DZ')} DZD`, ty);
  }
  ty += 4;
  doc.setDrawColor(26, 84, 255);
  doc.line(boxX, ty, pageW - 15, ty);
  ty += 6;
  doc.setFillColor(26, 84, 255);
  doc.rect(boxX - 3, ty - 5, pageW - boxX + 18, 10, 'F');
  doc.setTextColor(255, 255, 255);
  addTotal('TOTAL TTC :', `${Number(invoice.total).toLocaleString('fr-DZ')} DZD`, ty + 2, true);

  // Notes
  doc.setTextColor(60, 60, 60);
  if (invoice.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Note: ${invoice.notes}`, 15, ty + 14);
  }

  // Legal mentions
  if (company?.legalMentions) {
    const legalY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(company.legalMentions, pageW / 2, legalY, { align: 'center', maxWidth: pageW - 30 });
  }

  // Footer line
  doc.setDrawColor(26, 84, 255);
  doc.setLineWidth(0.5);
  doc.line(15, doc.internal.pageSize.getHeight() - 12, pageW - 15, doc.internal.pageSize.getHeight() - 12);

  doc.save(`${invoice.number}.pdf`);
}
