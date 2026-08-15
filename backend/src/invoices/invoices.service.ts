import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceType, InvoiceStatus, DeliveryStatus, PaymentStatus, WorkflowStep } from './invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserRole } from '../users/user.entity';
import { DeliveryGateway } from '../gateway/delivery.gateway';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    private deliveryGateway: DeliveryGateway,
  ) {}

  private async generateNumber(type: InvoiceType): Promise<string> {
    const prefix = type === InvoiceType.FACTURE ? 'FAC' : type === InvoiceType.PROFORMA ? 'PRO' : 'BL';
    const year = new Date().getFullYear();

    // FIX: on calcule le prochain numéro à partir du VRAI dernier numéro utilisé
    // (trié sur la colonne `number` elle-même), au lieu d'un simple COUNT() qui
    // divergeait dès qu'une facture était supprimée -> causait des doublons
    // et violait la contrainte unique UQ_6b20aa66f2a835a4f2fbde48724.
    const result = await this.invoicesRepository
      .createQueryBuilder('inv')
      .select('inv.number', 'number')
      .where('inv.type = :type', { type })
      .andWhere('inv.number LIKE :pattern', { pattern: `${prefix}-${year}-%` })
      .orderBy('inv.number', 'DESC')
      .limit(1)
      .getRawOne();

    let nextSeq = 1;
    if (result?.number) {
      const match = result.number.match(/-(\d+)$/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }

    return `${prefix}-${year}-${String(nextSeq).padStart(4, '0')}`;
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    try {
      const number = await this.generateNumber(dto.type);
      const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tvaAmount = dto.hasTva ? (subtotal * (dto.tvaRate || 19)) / 100 : 0;
      const total = subtotal + tvaAmount;

      const items = dto.items.map((item, i) => {
        const purchasePrice = (item as any).purchasePrice ?? 0;
        const margin = (item.unitPrice - purchasePrice) * item.quantity;
        return {
          id: String(i + 1),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          purchasePrice,
          margin,
          total: item.quantity * item.unitPrice,
        };
      });

      const totalMargin = items.reduce((sum, item) => sum + (item.margin || 0), 0);
      const clientId = this.buildClientId(dto.clientName, dto.clientPhone);

      const invoice = this.invoicesRepository.create({
        ...dto,
        number,
        items,
        subtotal,
        tvaAmount,
        total,
        totalMargin,
        clientId,
        clientLogoUrl: dto.clientLogoUrl || null,
        dueDate: dto.dueDate || null,
        deliveryDate: dto.deliveryDate || null,
        templateType: dto.templateType || null,
        notes: dto.notes || null,
        paymentStatus: PaymentStatus.UNPAID,
        createdBy: { id: userId } as any,
      });

      return await this.invoicesRepository.save(invoice);
    } catch (error) {
      console.error('=== ERROR in invoices.service.create ===');
      console.error('userId:', userId);
      console.error('dto.type:', dto.type);
      console.error('dto.clientName:', dto.clientName);
      console.error('dto.items count:', dto.items?.length);
      console.error('dto.hasTva:', dto.hasTva);
      console.error('Error details:', error instanceof Error ? error.message : error);
      console.error('Error stack:', error instanceof Error ? error.stack : '');
      console.error('========================================');
      throw error;
    }
  }

  async findAll(
    user: { id: string; role: UserRole },
    filters?: {
      client?: string;
      date?: string;
      status?: string;
      type?: string;
      paymentStatus?: string;
      number?: string;
    },
  ): Promise<Invoice[]> {
    try {
      const qb = this.invoicesRepository
        .createQueryBuilder('inv')
        .leftJoinAndSelect('inv.createdBy', 'createdBy')
        .leftJoinAndSelect('inv.lastModifiedBy', 'lastModifiedBy')
        .orderBy('inv.createdAt', 'DESC');

      const canSeeAll = user.role === UserRole.ADMIN || user.role === UserRole.COMMERCIAL;
      if (!canSeeAll) {
        qb.where('createdBy.id = :userId', { userId: user.id });
      }

      if (filters?.client) {
        qb.andWhere('LOWER(inv.clientName) LIKE :client', { client: `%${filters.client.toLowerCase()}%` });
      }
      if (filters?.number) {
        qb.andWhere('UPPER(inv.number) LIKE :number', {
          number: `%${filters.number.toUpperCase()}%`,
        });
      }
      if (filters?.date) {
        qb.andWhere('DATE(inv.createdAt) = :date', { date: filters.date });
      }
      if (filters?.status) {
        qb.andWhere('inv.status = :status', { status: filters.status });
      }
      if (filters?.paymentStatus) {
        qb.andWhere('inv.paymentStatus = :paymentStatus', { paymentStatus: filters.paymentStatus });
      }
      if (filters?.type) {
        qb.andWhere('inv.type = :type', { type: filters.type });
      }

      return await qb.getMany();
    } catch (error) {
      console.error('=== ERROR in invoices.service.findAll ===');
      console.error('user id:', user.id, 'role:', user.role);
      console.error('filters:', JSON.stringify(filters));
      console.error('Error:', error instanceof Error ? error.message : error);
      console.error('Stack:', error instanceof Error ? error.stack : '');
      console.error('========================================');
      // Fallback: try without the lastModifiedBy join (column may not exist in production)
      try {
        const qb = this.invoicesRepository
          .createQueryBuilder('inv')
          .leftJoinAndSelect('inv.createdBy', 'createdBy')
          .orderBy('inv.createdAt', 'DESC');
        const canSeeAll = user.role === UserRole.ADMIN || user.role === UserRole.COMMERCIAL;
        if (!canSeeAll) qb.where('createdBy.id = :userId', { userId: user.id });
        return await qb.getMany();
      } catch (fallbackError) {
        console.error('=== FALLBACK also failed ===', fallbackError);
        throw error;
      }
    }
  }

  private buildClientId(name: string, phone?: string): string {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return phone ? `${slug}-${phone.replace(/\D/g, '').slice(-6)}` : slug;
  }

  async findOne(id: string, user: { id: string; role: UserRole }): Promise<Invoice> {
    try {
      const invoice = await this.invoicesRepository.findOne({
        where: { id },
        relations: ['createdBy', 'lastModifiedBy'],
      });
      if (!invoice) throw new NotFoundException('Facture non trouvée');
      const canSeeAll = user.role === UserRole.ADMIN || user.role === UserRole.COMMERCIAL;
      if (!canSeeAll && invoice.createdBy.id !== user.id) {
        throw new ForbiddenException('Accès refusé');
      }
      return invoice;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      console.error('=== ERROR in invoices.service.findOne (fallback without lastModifiedBy) ===');
      console.error('id:', id, 'user:', user.id, 'role:', user.role);
      console.error('Error:', error instanceof Error ? error.message : error);
      // Fallback without lastModifiedBy
      const invoice = await this.invoicesRepository.findOne({
        where: { id },
        relations: ['createdBy'],
      });
      if (!invoice) throw new NotFoundException('Facture non trouvée');
      const canSeeAll = user.role === UserRole.ADMIN || user.role === UserRole.COMMERCIAL;
      if (!canSeeAll && invoice.createdBy.id !== user.id) {
        throw new ForbiddenException('Accès refusé');
      }
      return invoice;
    }
  }

  async update(id: string, dto: UpdateInvoiceDto, user: { id: string; role: UserRole }): Promise<Invoice> {
    const invoice = await this.findOne(id, user);
    invoice.lastModifiedBy = { id: user.id } as any;

    if (dto.type !== undefined) invoice.type = dto.type;
    if (dto.status !== undefined) invoice.status = dto.status;
    if (dto.clientName !== undefined) invoice.clientName = dto.clientName;
    if (dto.clientEmail !== undefined) invoice.clientEmail = dto.clientEmail || null;
    if (dto.clientPhone !== undefined) invoice.clientPhone = dto.clientPhone || null;
    if (dto.clientAddress !== undefined) invoice.clientAddress = dto.clientAddress || null;
    if (dto.clientNif !== undefined) invoice.clientNif = dto.clientNif || null;
    if (dto.clientNis !== undefined) invoice.clientNis = dto.clientNis || null;
    if (dto.notes !== undefined) invoice.notes = dto.notes || null;
    if (dto.dueDate !== undefined) invoice.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.deliveryDate !== undefined) invoice.deliveryDate = dto.deliveryDate ? new Date(dto.deliveryDate) : null;
    if (dto.templateType !== undefined) invoice.templateType = dto.templateType || null;
    if (dto.issuerName !== undefined) invoice.issuerName = dto.issuerName || null;
    if (dto.hasTva !== undefined) invoice.hasTva = dto.hasTva;
    if (dto.tvaRate !== undefined) invoice.tvaRate = dto.tvaRate;

    if (dto.items && dto.items.length > 0) {
      const hasTva = dto.hasTva ?? invoice.hasTva;
      const tvaRate = dto.tvaRate ?? invoice.tvaRate ?? 19;
      const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tvaAmount = hasTva ? (subtotal * tvaRate) / 100 : 0;
      const total = subtotal + tvaAmount;

      const items = dto.items.map((item, i) => {
        const purchasePrice = item.purchasePrice ?? 0;
        const margin = (item.unitPrice - purchasePrice) * item.quantity;
        return {
          id: String(i + 1),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          purchasePrice,
          margin,
          total: item.quantity * item.unitPrice,
        };
      });

      invoice.items = items;
      invoice.subtotal = subtotal;
      invoice.tvaAmount = tvaAmount;
      invoice.total = total;
      invoice.totalMargin = items.reduce((sum, item) => sum + (item.margin || 0), 0);
    } else if (dto.hasTva !== undefined || dto.tvaRate !== undefined) {
      const hasTva = dto.hasTva ?? invoice.hasTva;
      const tvaRate = dto.tvaRate ?? invoice.tvaRate ?? 19;
      const subtotal = Number(invoice.subtotal);
      invoice.tvaAmount = hasTva ? (subtotal * tvaRate) / 100 : 0;
      invoice.total = subtotal + Number(invoice.tvaAmount);
    }

    if (dto.clientName) {
      invoice.clientId = this.buildClientId(dto.clientName, dto.clientPhone ?? invoice.clientPhone);
    }

    return this.invoicesRepository.save(invoice);
  }

  async updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    invoice.deliveryStatus = status;
    const saved = await this.invoicesRepository.save(invoice);
    // Lien livreur → commercial : le commercial est notifié en temps réel
    this.deliveryGateway.emitDeliveryUpdatedByLivreur(saved.id, {
      number: saved.number,
      clientName: saved.clientName,
      status: saved.deliveryStatus,
    });
    return saved;
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    invoice.paymentStatus = paymentStatus;
    if (paymentStatus === PaymentStatus.PAID) {
      invoice.status = InvoiceStatus.PAYEE;
      invoice.workflowStep = WorkflowStep.RECOUVREMENT;
    }
    return this.invoicesRepository.save(invoice);
  }

  async updateWorkflowStep(id: string, step: WorkflowStep): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    invoice.workflowStep = step;
    return this.invoicesRepository.save(invoice);
  }

  async remove(id: string): Promise<void> {
    await this.invoicesRepository.delete(id);
  }

  async getStats(): Promise<any> {
    const total = await this.invoicesRepository.count();
    const paid = await this.invoicesRepository.count({ where: { status: InvoiceStatus.PAYEE } });
    const pending = await this.invoicesRepository.count({ where: { status: InvoiceStatus.EMISE } });
    const result = await this.invoicesRepository
      .createQueryBuilder('inv')
      .select('SUM(inv.total)', 'totalRevenue')
      .where('inv.status = :status', { status: InvoiceStatus.PAYEE })
      .getRawOne();

    return { total, paid, pending, totalRevenue: result?.totalRevenue || 0 };
  }
}