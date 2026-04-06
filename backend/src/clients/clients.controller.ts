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
import { Invoice } from '../invoices/invoice.entity';
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

  // GET /clients?name=
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

  // GET /clients/:id/documents
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

    const totalPaid = factures
      .filter((f) => (f as any).paymentStatus === 'paid')
      .reduce((sum, f) => sum + Number(f.total), 0);

    const totalUnpaid = factures
      .filter((f) => (f as any).paymentStatus === 'unpaid')
      .reduce((sum, f) => sum + Number(f.total), 0);

    const clientLogoUrl =
      docs.find((d) => !!(d as any).clientLogoUrl)?.['clientLogoUrl'] ?? null;

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

  // PATCH /clients/:id/logo — file upload, propagate to all docs
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
  async uploadLogo(
    @Param('id') clientId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const logoUrl = `/uploads/logos/${file.filename}`;
    await this.invoicesRepo.createQueryBuilder()
      .update(Invoice)
      .set({ clientLogoUrl: logoUrl } as any)
      .where('clientId = :clientId', { clientId })
      .execute();
    return { success: true, clientLogoUrl: logoUrl };
  }

  // PATCH /clients/:id/logo-remove
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