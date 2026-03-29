import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
  ) {}

  // GET /clients?name= — liste des clients uniques avec stats
  @Get()
  async getClients(@Query('name') name?: string) {
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect('inv.clientEmail', 'clientEmail')
      .addSelect('inv.clientPhone', 'clientPhone')
      .addSelect('inv.clientAddress', 'clientAddress')
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

  // GET /clients/:id/documents — tous les documents d'un client
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

    // Group by type
    const factures = docs.filter((d) => d.type === 'facture');
    const proformas = docs.filter((d) => d.type === 'proforma');
    const bons = docs.filter((d) => d.type === 'bon_livraison');

    const totalPaid = factures
      .filter((f) => (f as any).paymentStatus === 'paid')
      .reduce((sum, f) => sum + Number(f.total), 0);

    const totalUnpaid = factures
      .filter((f) => (f as any).paymentStatus === 'unpaid')
      .reduce((sum, f) => sum + Number(f.total), 0);

    return {
      clientId,
      clientName: docs[0]?.clientName || '',
      clientEmail: docs[0]?.clientEmail || '',
      clientPhone: docs[0]?.clientPhone || '',
      clientAddress: docs[0]?.clientAddress || '',
      summary: {
        totalDocuments: docs.length,
        totalPaid,
        totalUnpaid,
        facturesCount: factures.length,
        proformasCount: proformas.length,
        bonsCount: bons.length,
      },
      factures,
      proformas,
      bonsLivraison: bons,
    };
  }
}
