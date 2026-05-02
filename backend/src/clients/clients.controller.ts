import {
  Controller, Get, Param, Query, Patch, Body,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Invoice, PaymentStatus, InvoiceStatus } from '../invoices/invoice.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const logoStorage = diskStorage({
  destination: './uploads/logos',
  filename: (req, file, cb) => cb(null, `client-${uuidv4()}${extname(file.originalname)}`),
});

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
  ) {}

  @Get()
  async getClients(@Query('name') name?: string) {
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect('inv.clientEmail', 'clientEmail')
      .addSelect('inv.clientPhone', 'clientPhone')
      .addSelect('inv.clientAddress', 'clientAddress')
      .addSelect('MAX(inv.clientLogoUrl)', 'clientLogoUrl')
      .addSelect('COUNT(*)', 'documentCount')
      .addSelect('SUM(inv.total)', 'totalAmount')
      // MOD 1: add unpaid amount per client
      .addSelect(
        "SUM(CASE WHEN inv.paymentStatus = 'unpaid' AND inv.status != 'annulee' AND inv.type = 'facture' THEN inv.total ELSE 0 END)",
        'unpaidAmount',
      )
      .addSelect(
        "COUNT(CASE WHEN inv.paymentStatus = 'unpaid' AND inv.status != 'annulee' AND inv.type = 'facture' THEN 1 END)",
        'unpaidCount',
      )
      .groupBy('inv.clientName')
      .addGroupBy('inv.clientId')
      .addGroupBy('inv.clientEmail')
      .addGroupBy('inv.clientPhone')
      .addGroupBy('inv.clientAddress')
      .orderBy('inv.clientName', 'ASC');

    if (name) {
      qb.where('LOWER(inv.clientName) LIKE :name', { name: `%${name.toLowerCase()}%` });
    }

    return qb.getRawMany();
  }

  // MOD 5: detailed client page — all info, invoices, products, stats
  @Get(':id/details')
  async getClientDetails(
    @Param('id') clientId: string,
    @Query('type') type?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.createdBy', 'createdBy')
      .leftJoinAndSelect('inv.lastModifiedBy', 'lastModifiedBy')
      .where('inv.clientId = :clientId', { clientId })
      .orderBy('inv.createdAt', 'DESC');

    if (type) qb.andWhere('inv.type = :type', { type });
    if (paymentStatus) qb.andWhere('inv.paymentStatus = :paymentStatus', { paymentStatus });

    const docs = await qb.getMany();
    if (docs.length === 0) {
      return {
        clientId,
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        clientLogoUrl: null,
        summary: { totalDocuments: 0, totalRevenue: 0, totalPaid: 0, totalUnpaid: 0, facturesCount: 0, proformasCount: 0, bonsCount: 0, averageInvoice: 0, firstOrder: null, lastOrder: null },
        factures: [],
        proformas: [],
        bonsLivraison: [],
        products: [],
        monthlyRevenue: [],
      };
    }

    const factures = docs.filter((d) => d.type === 'facture');
    const proformas = docs.filter((d) => d.type === 'proforma');
    const bons = docs.filter((d) => d.type === 'bon_livraison');

    const totalPaid = factures.filter((f) => (f as any).paymentStatus === 'paid').reduce((s, f) => s + Number(f.total), 0);
    const totalUnpaid = factures.filter((f) => (f as any).paymentStatus === 'unpaid').reduce((s, f) => s + Number(f.total), 0);
    const totalRevenue = factures.reduce((s, f) => s + Number(f.total), 0);

    // MOD 5: aggregate products from all invoice items
    const productMap: Record<string, { name: string; qty: number; revenue: number; lastDate: string }> = {};
    for (const inv of factures) {
      const items = Array.isArray(inv.items) ? inv.items : [];
      for (const item of items) {
        const key = item.description;
        if (!productMap[key]) {
          productMap[key] = { name: key, qty: 0, revenue: 0, lastDate: inv.createdAt as any };
        }
        productMap[key].qty += Number(item.quantity);
        productMap[key].revenue += Number(item.total);
        if (new Date(inv.createdAt) > new Date(productMap[key].lastDate)) {
          productMap[key].lastDate = inv.createdAt as any;
        }
      }
    }
    const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    // MOD 5: monthly revenue for this client
    const monthlyMap: Record<string, number> = {};
    for (const inv of factures) {
      const month = new Date(inv.createdAt).toISOString().slice(0, 7);
      monthlyMap[month] = (monthlyMap[month] || 0) + Number(inv.total);
    }
    const monthlyRevenue = Object.entries(monthlyMap)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const clientLogoUrl = docs.find((d) => (d as any).clientLogoUrl)?.['clientLogoUrl'] ?? null;
    const dates = factures.map((f) => new Date(f.createdAt));

    return {
      clientId,
      clientName: docs[0]?.clientName || '',
      clientEmail: docs[0]?.clientEmail || '',
      clientPhone: docs[0]?.clientPhone || '',
      clientAddress: docs[0]?.clientAddress || '',
      clientLogoUrl,
      summary: {
        totalDocuments: docs.length,
        totalRevenue,
        totalPaid,
        totalUnpaid,
        facturesCount: factures.length,
        proformasCount: proformas.length,
        bonsCount: bons.length,
        averageInvoice: factures.length > 0 ? totalRevenue / factures.length : 0,
        firstOrder: dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
        lastOrder: dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
      },
      factures,
      proformas,
      bonsLivraison: bons,
      products,
      monthlyRevenue,
    };
  }

  // Keep legacy /clients/:id/documents for backward compatibility
  @Get(':id/documents')
  async getClientDocuments(
    @Param('id') clientId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.createdBy', 'createdBy')
      .where('inv.clientId = :clientId', { clientId })
      .orderBy('inv.createdAt', 'DESC');

    if (type) qb.andWhere('inv.type = :type', { type });
    if (status) qb.andWhere('inv.paymentStatus = :status', { status });

    const docs = await qb.getMany();
    const factures = docs.filter((d) => d.type === 'facture');
    const proformas = docs.filter((d) => d.type === 'proforma');
    const bons = docs.filter((d) => d.type === 'bon_livraison');
    const totalPaid = factures.filter((f) => (f as any).paymentStatus === 'paid').reduce((sum, f) => sum + Number(f.total), 0);
    const totalUnpaid = factures.filter((f) => (f as any).paymentStatus === 'unpaid').reduce((sum, f) => sum + Number(f.total), 0);
    const clientLogoUrl = docs.find((d) => !!(d as any).clientLogoUrl)?.['clientLogoUrl'] ?? null;

    return {
      clientId,
      clientName: docs[0]?.clientName || '',
      clientEmail: docs[0]?.clientEmail || '',
      clientPhone: docs[0]?.clientPhone || '',
      clientAddress: docs[0]?.clientAddress || '',
      clientLogoUrl,
      summary: { totalDocuments: docs.length, totalPaid, totalUnpaid, facturesCount: factures.length, proformasCount: proformas.length, bonsCount: bons.length },
      factures,
      proformas,
      bonsLivraison: bons,
    };
  }

  @Patch(':id/logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: logoStorage,
    fileFilter: (req, file, cb) => {
      const ok = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
      if (!ok.includes(extname(file.originalname).toLowerCase())) {
        return cb(new BadRequestException('Format non supporté'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadLogo(@Param('id') clientId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const logoUrl = `/uploads/logos/${file.filename}`;
    await this.invoicesRepo.createQueryBuilder()
      .update(Invoice)
      .set({ clientLogoUrl: logoUrl } as any)
      .where('clientId = :clientId', { clientId })
      .execute();
    return { success: true, clientLogoUrl: logoUrl };
  }

  @Patch(':id/logo-remove')
  async removeLogo(@Param('id') clientId: string) {
    await this.invoicesRepo.createQueryBuilder()
      .update(Invoice)
      .set({ clientLogoUrl: null } as any)
      .where('clientId = :clientId', { clientId })
      .execute();
    return { success: true };
  }
}
