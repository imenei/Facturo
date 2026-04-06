import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceType, InvoiceStatus, DeliveryStatus, PaymentStatus, WorkflowStep } from './invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserRole } from '../users/user.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  private async generateNumber(type: InvoiceType): Promise<string> {
    const prefix = type === InvoiceType.FACTURE ? 'FAC' : type === InvoiceType.PROFORMA ? 'PRO' : 'BL';
    const year = new Date().getFullYear();
    const count = await this.invoicesRepository.count({ where: { type } });
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    const number = await this.generateNumber(dto.type);
    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tvaAmount = dto.hasTva ? (subtotal * (dto.tvaRate || 19)) / 100 : 0;
    const total = subtotal + tvaAmount;

    const items = dto.items.map((item, i) => ({
      id: String(i + 1),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const clientId = this.buildClientId(dto.clientName, dto.clientPhone);

    const invoice = this.invoicesRepository.create({
      ...dto,
      number,
      items,
      subtotal,
      tvaAmount,
      total,
      clientId,
      clientLogoUrl: dto.clientLogoUrl ?? undefined, // ✅ fix ts2769: no null
      paymentStatus: PaymentStatus.UNPAID,
      createdBy: { id: userId } as any,
    });

    return this.invoicesRepository.save(invoice);
  }

  async findAll(
    user: { id: string; role: UserRole },
    filters?: { client?: string; date?: string; status?: string; type?: string; paymentStatus?: string },
  ): Promise<Invoice[]> {
    const qb = this.invoicesRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.createdBy', 'createdBy')
      .orderBy('inv.createdAt', 'DESC');

    if (user.role !== UserRole.ADMIN) {
      qb.where('createdBy.id = :userId', { userId: user.id });
    }

    if (filters?.client) {
      qb.andWhere('LOWER(inv.clientName) LIKE :client', { client: `%${filters.client.toLowerCase()}%` });
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

    return qb.getMany();
  }

  private buildClientId(name: string, phone?: string): string {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return phone ? `${slug}-${phone.replace(/\D/g, '').slice(-6)}` : slug;
  }

  async findOne(id: string, user: { id: string; role: UserRole }): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id }, relations: ['createdBy'] });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    if (user.role !== UserRole.ADMIN && invoice.createdBy.id !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto, user: { id: string; role: UserRole }): Promise<Invoice> {
    const invoice = await this.findOne(id, user);

    if (dto.items) {
      // ✅ fix ts7053: calculs locaux au lieu d'indexer UpdateInvoiceDto
      const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tvaAmount = dto.hasTva ? (subtotal * (dto.tvaRate || 19)) / 100 : 0;
      const total = subtotal + tvaAmount;

      Object.assign(invoice, { subtotal, tvaAmount, total });
    }

    Object.assign(invoice, dto);
    return this.invoicesRepository.save(invoice);
  }

  async updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    invoice.deliveryStatus = status;
    return this.invoicesRepository.save(invoice);
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