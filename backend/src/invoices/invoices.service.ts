import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Invoice, InvoiceAdjustmentType, InvoiceType, InvoiceStatus, DeliveryStatus, PaymentStatus, WorkflowStep } from './invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserRole } from '../users/user.entity';
import { DeliveryGateway } from '../gateway/delivery.gateway';
import { InvoiceDeletionRequest, DeletionRequestStatus } from './invoice-deletion-request.entity';
import { UsersService } from '../users/users.service';
import { TasksService } from '../tasks/tasks.service';
import { roundMoney, computeNetProfit, parseDateOnly } from '../common/money';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceDeletionRequest)
    private deletionRequestsRepository: Repository<InvoiceDeletionRequest>,
    private deliveryGateway: DeliveryGateway,
    private usersService: UsersService,
    private tasksService: TasksService,
    private dataSource: DataSource,
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

  private calculateInvoiceTotals(
    subtotal: number,
    hasTva: boolean,
    tvaRate: number,
    adjustmentType: InvoiceAdjustmentType,
    adjustmentPercent: number,
    additionalCharges = 0,
  ) {
    const normalizedPercent = Math.min(Math.max(Number(adjustmentPercent) || 0, 0), 100);
    const adjustmentAmount = roundMoney((subtotal * normalizedPercent) / 100);
    const adjustedSubtotal = roundMoney(
      adjustmentType === InvoiceAdjustmentType.ADDITION ? subtotal + adjustmentAmount : subtotal - adjustmentAmount,
    );
    const subtotalWithCharges = roundMoney(adjustedSubtotal + additionalCharges);
    const tvaAmount = hasTva ? roundMoney((subtotalWithCharges * (tvaRate || 19)) / 100) : 0;
    const total = roundMoney(subtotalWithCharges + tvaAmount);

    return {
      discountPercent: adjustmentType === InvoiceAdjustmentType.DISCOUNT ? normalizedPercent : 0,
      discountAmount: adjustmentType === InvoiceAdjustmentType.DISCOUNT ? adjustmentAmount : 0,
      adjustmentType,
      adjustmentPercent: normalizedPercent,
      adjustmentAmount,
      subtotal: subtotalWithCharges,
      tvaAmount,
      total,
    };
  }

  private validateDeliveryDate(referenceDate?: string | Date | null, deliveryDate?: string | Date | null) {
    if (!deliveryDate) return;
    const baseDate = referenceDate ? new Date(referenceDate) : new Date();
    const delivery = new Date(deliveryDate);
    if (Number.isNaN(baseDate.getTime()) || Number.isNaN(delivery.getTime())) return;
    if (delivery.toISOString().slice(0, 10) < baseDate.toISOString().slice(0, 10)) {
      throw new BadRequestException('La date de livraison ne peut pas être antérieure à la date de facturation.');
    }
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    try {
      const sourceInvoice = dto.sourceInvoiceId
        ? await this.invoicesRepository.findOne({ where: { id: dto.sourceInvoiceId, isDeleted: false } })
        : null;
      if (dto.sourceInvoiceId && (!sourceInvoice || sourceInvoice.type !== InvoiceType.FACTURE)) {
        throw new BadRequestException('Un bon de livraison ne peut provenir que d’une facture définitive active.');
      }

      const resolvedClientName = dto.clientName || sourceInvoice?.clientName || 'Client';
      const resolvedClientPhone = dto.clientPhone || sourceInvoice?.clientPhone || undefined;
      const resolvedClientAddress = dto.clientAddress || sourceInvoice?.clientAddress || undefined;
      const resolvedClientEmail = dto.clientEmail || sourceInvoice?.clientEmail || undefined;
      const resolvedClientNif = dto.clientNif || sourceInvoice?.clientNif || undefined;
      const resolvedClientNis = dto.clientNis || sourceInvoice?.clientNis || undefined;
      const resolvedClientLogoUrl = dto.clientLogoUrl || sourceInvoice?.clientLogoUrl || null;
      const resolvedItems = dto.items?.length ? dto.items : (sourceInvoice?.items || []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        purchasePrice: Number((item as any).purchasePrice || 0),
      }));

      const number = await this.generateNumber(dto.type);
      const subtotal = roundMoney(resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
      const otherCharges = (dto.otherCharges || []).map((charge) => ({
        description: charge.description.trim(),
        amount: roundMoney(charge.amount),
      })).filter((charge) => charge.description || charge.amount > 0);
      const additionalCharges = roundMoney(otherCharges.reduce((sum, charge) => sum + charge.amount, 0));
      const adjustmentType = dto.adjustmentType || InvoiceAdjustmentType.DISCOUNT;
      const adjustmentPercent = dto.adjustmentPercent ?? dto.discountPercent ?? 0;
      const totals = this.calculateInvoiceTotals(subtotal, Boolean(dto.hasTva), Number(dto.tvaRate || 19), adjustmentType, adjustmentPercent, additionalCharges);
      this.validateDeliveryDate(sourceInvoice?.createdAt || new Date(), dto.deliveryDate);
      const tvaAmount = totals.tvaAmount;
      const total = totals.total;

      const items = resolvedItems.map((item, i) => {
        const purchasePrice = roundMoney((item as any).purchasePrice ?? 0);
        const unitPrice = roundMoney(item.unitPrice);
        const quantity = Number(item.quantity) || 0;
        const margin = roundMoney((unitPrice - purchasePrice) * quantity);
        return {
          id: String(i + 1),
          description: item.description,
          quantity,
          unitPrice,
          purchasePrice,
          margin,
          total: roundMoney(quantity * unitPrice),
        };
      });

      const totalMargin = roundMoney(items.reduce((sum, item) => sum + (item.margin || 0), 0));
      const otherCharge = roundMoney(dto.otherCharge ?? 0);
      const deliveryPrice = roundMoney(dto.deliveryPrice ?? 0);
      const delivery = await this.resolveDeliveryPerson(dto.deliveryPersonId);
      const clientId = this.buildClientId(resolvedClientName, resolvedClientPhone || undefined);

      const invoice = this.invoicesRepository.create({
        ...dto,
        sourceInvoiceId: dto.sourceInvoiceId || sourceInvoice?.id || null,
        number,
        clientName: resolvedClientName,
        clientEmail: resolvedClientEmail || null,
        clientPhone: resolvedClientPhone || null,
        clientAddress: resolvedClientAddress || null,
        clientNif: resolvedClientNif || null,
        clientNis: resolvedClientNis || null,
        items,
        subtotal: totals.subtotal,
        discountPercent: totals.discountPercent,
        discountAmount: totals.discountAmount,
        adjustmentType: totals.adjustmentType,
        adjustmentPercent: totals.adjustmentPercent,
        adjustmentAmount: totals.adjustmentAmount,
        tvaAmount,
        total,
        totalMargin,
        otherCharge,
        otherCharges,
        deliveryPrice,
        deliveryPersonId: delivery.id,
        deliveryPersonName: delivery.name,
        netProfit: computeNetProfit(
          totalMargin + additionalCharges + (adjustmentType === InvoiceAdjustmentType.ADDITION ? totals.adjustmentAmount : -totals.adjustmentAmount),
          otherCharge,
          deliveryPrice,
        ),
        issuerNameSize: dto.issuerNameSize ?? 16,
        clientId,
        clientLogoUrl: resolvedClientLogoUrl || null,
        dueDate: parseDateOnly(dto.dueDate),
        deliveryDate: parseDateOnly(dto.deliveryDate),
        templateType: dto.templateType || null,
        notes: dto.notes || null,
        paymentStatus: PaymentStatus.UNPAID,
        createdBy: { id: userId } as any,
      });

      const savedInvoice = await this.invoicesRepository.save(invoice);
      await this.tasksService.syncInvoiceTask(savedInvoice, userId);
      return savedInvoice;
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
        .where('inv.isDeleted = :isDeleted', { isDeleted: false })
        .orderBy('inv.createdAt', 'DESC');

      const canSeeAll = user.role === UserRole.ADMIN || user.role === UserRole.COMMERCIAL;
      if (!canSeeAll) {
        qb.andWhere('createdBy.id = :userId', { userId: user.id });
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
        where: { id, isDeleted: false },
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

    const effectiveReferenceDate = invoice.createdAt ?? new Date();
    this.validateDeliveryDate(effectiveReferenceDate, dto.deliveryDate ?? invoice.deliveryDate ?? null);

    if (dto.type !== undefined) invoice.type = dto.type;
    if (dto.status !== undefined) invoice.status = dto.status;
    if (dto.clientName !== undefined) invoice.clientName = dto.clientName;
    if (dto.clientEmail !== undefined) invoice.clientEmail = dto.clientEmail || null;
    if (dto.clientPhone !== undefined) invoice.clientPhone = dto.clientPhone || null;
    if (dto.clientAddress !== undefined) invoice.clientAddress = dto.clientAddress || null;
    if (dto.clientNif !== undefined) invoice.clientNif = dto.clientNif || null;
    if (dto.clientNis !== undefined) invoice.clientNis = dto.clientNis || null;
    if (dto.notes !== undefined) invoice.notes = dto.notes || null;
    if (dto.dueDate !== undefined) invoice.dueDate = parseDateOnly(dto.dueDate);
    if (dto.deliveryDate !== undefined) invoice.deliveryDate = parseDateOnly(dto.deliveryDate);
    if (dto.adjustmentType !== undefined) invoice.adjustmentType = dto.adjustmentType;
    if (dto.adjustmentPercent !== undefined) invoice.adjustmentPercent = roundMoney(dto.adjustmentPercent);
    else if (dto.discountPercent !== undefined) {
      invoice.adjustmentType = InvoiceAdjustmentType.DISCOUNT;
      invoice.adjustmentPercent = roundMoney(dto.discountPercent);
    }
    if (dto.adjustmentType !== undefined || dto.adjustmentPercent !== undefined || dto.discountPercent !== undefined) {
      const baseSubtotal = roundMoney(invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0));
      const additionalCharges = roundMoney((invoice.otherCharges || []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
      const totals = this.calculateInvoiceTotals(baseSubtotal, Boolean(invoice.hasTva), Number(invoice.tvaRate || 19), invoice.adjustmentType || InvoiceAdjustmentType.DISCOUNT, Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0), additionalCharges);
      invoice.discountPercent = totals.discountPercent;
      invoice.discountAmount = totals.discountAmount;
      invoice.adjustmentType = totals.adjustmentType;
      invoice.adjustmentPercent = totals.adjustmentPercent;
      invoice.adjustmentAmount = totals.adjustmentAmount;
      invoice.subtotal = totals.subtotal;
      invoice.tvaAmount = totals.tvaAmount;
      invoice.total = totals.total;
    }
    if (dto.templateType !== undefined) invoice.templateType = dto.templateType || null;
    if (dto.issuerName !== undefined) invoice.issuerName = dto.issuerName || null;
    if (dto.issuerNameSize !== undefined) invoice.issuerNameSize = dto.issuerNameSize;
    if (dto.hasTva !== undefined) invoice.hasTva = dto.hasTva;
    if (dto.tvaRate !== undefined) invoice.tvaRate = dto.tvaRate;
    if (dto.otherCharges !== undefined) {
      invoice.otherCharges = dto.otherCharges
        .map((charge) => ({ description: charge.description.trim(), amount: roundMoney(charge.amount) }))
        .filter((charge) => charge.description || charge.amount > 0);
      invoice.otherCharge = roundMoney(invoice.otherCharges.reduce((sum, charge) => sum + charge.amount, 0));
    } else if (dto.otherCharge !== undefined) {
      invoice.otherCharge = roundMoney(dto.otherCharge);
      invoice.otherCharges = invoice.otherCharge > 0 ? [{ description: 'Autre charge', amount: invoice.otherCharge }] : [];
    }
    if (dto.deliveryPrice !== undefined) invoice.deliveryPrice = roundMoney(dto.deliveryPrice);
    if (dto.deliveryPersonId !== undefined) {
      const delivery = await this.resolveDeliveryPerson(dto.deliveryPersonId);
      invoice.deliveryPersonId = delivery.id;
      invoice.deliveryPersonName = delivery.name;
    }

    if (dto.items && dto.items.length > 0) {
      const hasTva = dto.hasTva ?? invoice.hasTva;
      const tvaRate = dto.tvaRate ?? invoice.tvaRate ?? 19;
      const oldItems = Array.isArray(invoice.items) ? invoice.items : [];

      const items = dto.items.map((item, i) => {
        const purchasePrice = roundMoney(item.purchasePrice ?? (oldItems[i] as any)?.purchasePrice ?? 0);
        const unitPrice = roundMoney(item.unitPrice);
        const quantity = Number(item.quantity) || 0;
        const margin = roundMoney((unitPrice - purchasePrice) * quantity);
        return {
          id: String(i + 1),
          description: item.description,
          quantity,
          unitPrice,
          purchasePrice,
          margin,
          total: roundMoney(quantity * unitPrice),
        };
      });

      const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
      const additionalCharges = roundMoney((invoice.otherCharges || []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
      const totals = this.calculateInvoiceTotals(subtotal, hasTva, tvaRate, invoice.adjustmentType || InvoiceAdjustmentType.DISCOUNT, Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0), additionalCharges);
      invoice.items = items;
      invoice.subtotal = totals.subtotal;
      invoice.discountPercent = totals.discountPercent;
      invoice.discountAmount = totals.discountAmount;
      invoice.adjustmentType = totals.adjustmentType;
      invoice.adjustmentPercent = totals.adjustmentPercent;
      invoice.adjustmentAmount = totals.adjustmentAmount;
      invoice.tvaAmount = totals.tvaAmount;
      invoice.total = totals.total;
      invoice.totalMargin = roundMoney(items.reduce((sum, item) => sum + (item.margin || 0), 0));
    } else if (dto.hasTva !== undefined || dto.tvaRate !== undefined || dto.discountPercent !== undefined || dto.adjustmentType !== undefined || dto.adjustmentPercent !== undefined || dto.otherCharges !== undefined) {
      const hasTva = dto.hasTva ?? invoice.hasTva;
      const tvaRate = dto.tvaRate ?? invoice.tvaRate ?? 19;
      const baselineSubtotal = roundMoney(invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0));
      const additionalCharges = roundMoney((invoice.otherCharges || []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
      const totals = this.calculateInvoiceTotals(baselineSubtotal, hasTva, tvaRate, invoice.adjustmentType || InvoiceAdjustmentType.DISCOUNT, Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0), additionalCharges);
      invoice.subtotal = totals.subtotal;
      invoice.discountPercent = totals.discountPercent;
      invoice.discountAmount = totals.discountAmount;
      invoice.adjustmentType = totals.adjustmentType;
      invoice.adjustmentPercent = totals.adjustmentPercent;
      invoice.adjustmentAmount = totals.adjustmentAmount;
      invoice.tvaAmount = totals.tvaAmount;
      invoice.total = totals.total;
    }

    if (dto.clientName) {
      invoice.clientId = this.buildClientId(dto.clientName, dto.clientPhone ?? invoice.clientPhone);
    }

    invoice.netProfit = computeNetProfit(
      Number(invoice.totalMargin || 0) + Number((invoice.otherCharges || []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0)) + (invoice.adjustmentType === InvoiceAdjustmentType.ADDITION ? Number(invoice.adjustmentAmount || 0) : -Number(invoice.adjustmentAmount || 0)),
      Number(invoice.otherCharge || 0),
      Number(invoice.deliveryPrice || 0),
    );

    const savedInvoice = await this.invoicesRepository.save(invoice);
    await this.tasksService.syncInvoiceTask(savedInvoice, user.id);
    return savedInvoice;
  }

  async deleteDeletionRequest(requestId: string, user: { id: string; role: UserRole }) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut supprimer une demande de suppression');
    }

    const request = await this.deletionRequestsRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Demande introuvable');

    await this.deletionRequestsRepository.delete(requestId);
    return { success: true, deletedId: requestId };
  }

  async updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    if (invoice.type === InvoiceType.PROFORMA) {
      throw new BadRequestException('Une proforma ne peut pas recevoir de statut de livraison.');
    }
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
    if (invoice.type === InvoiceType.PROFORMA) {
      throw new BadRequestException('Une proforma ne peut pas être mise en recouvrement.');
    }
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
    if (invoice.type === InvoiceType.PROFORMA && step !== WorkflowStep.COMMANDE) {
      throw new BadRequestException('Une proforma ne peut pas passer aux étapes livraison, facturation ou recouvrement.');
    }
    invoice.workflowStep = step;
    return this.invoicesRepository.save(invoice);
  }

  async getTrash(user: { id: string; role: UserRole }): Promise<Invoice[]> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut accéder à la corbeille');
    }
    return this.invoicesRepository.find({
      where: { isDeleted: true },
      relations: ['createdBy', 'lastModifiedBy'],
      order: { deletedAt: 'DESC' },
    });
  }

  async restore(id: string, user: { id: string; role: UserRole }): Promise<Invoice> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut restaurer une facture');
    }
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    invoice.isDeleted = false;
    invoice.deletedAt = null;
    return this.invoicesRepository.save(invoice);
  }

  async remove(id: string, user: { id: string; role: UserRole }): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut supprimer une facture');
    }
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    invoice.isDeleted = true;
    invoice.deletedAt = new Date();
    await this.invoicesRepository.save(invoice);
  }

  async requestDeletion(invoiceId: string, reason: string, user: { id: string; role: UserRole }) {
    const trimmed = (reason || '').trim();
    if (!trimmed) throw new BadRequestException('Le motif de suppression est obligatoire');

    const invoice = await this.findOne(invoiceId, user);
    const existing = await this.deletionRequestsRepository.findOne({
      where: { invoiceId, status: DeletionRequestStatus.PENDING },
    });
    if (existing) {
      throw new BadRequestException('Une demande de suppression est déjà en attente pour cette facture');
    }

    const request = this.deletionRequestsRepository.create({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientName: invoice.clientName,
      reason: trimmed,
      status: DeletionRequestStatus.PENDING,
      requestedBy: { id: user.id } as any,
    });
    return this.deletionRequestsRepository.save(request);
  }

  async listDeletionRequests() {
    return this.deletionRequestsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async reviewDeletionRequest(
    requestId: string,
    approve: boolean,
    user: { id: string; role: UserRole },
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut traiter cette demande');
    }
    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(InvoiceDeletionRequest);
      const invoices = manager.getRepository(Invoice);
      const request = await requests.findOne({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Demande introuvable');
      if (request.status !== DeletionRequestStatus.PENDING) {
        throw new BadRequestException('Cette demande a déjà été traitée');
      }
      if (approve && !(await invoices.findOne({ where: { id: request.invoiceId } }))) {
        throw new NotFoundException('La facture concernée est introuvable');
      }

      request.status = approve ? DeletionRequestStatus.APPROVED : DeletionRequestStatus.REJECTED;
      request.reviewedBy = { id: user.id } as any;
      request.reviewedAt = new Date();
      await requests.save(request);
      if (approve) {
        await invoices.update(request.invoiceId, {
          isDeleted: true,
          deletedAt: new Date(),
        });
      }
      return request;
    });
  }

  private async resolveDeliveryPerson(id?: string | null): Promise<{ id: string | null; name: string | null }> {
    if (!id) return { id: null, name: null };
    try {
      const user = await this.usersService.findOne(id);
      return { id: user.id, name: user.name };
    } catch {
      return { id: null, name: null };
    }
  }

  async getStats(): Promise<any> {
    const total = await this.invoicesRepository.count({ where: { isDeleted: false } });
    const paid = await this.invoicesRepository.count({ where: { status: InvoiceStatus.PAYEE, isDeleted: false } });
    const pending = await this.invoicesRepository.count({ where: { status: InvoiceStatus.EMISE, isDeleted: false } });
    const result = await this.invoicesRepository
      .createQueryBuilder('inv')
      .select('SUM(inv.total)', 'totalRevenue')
      .where('inv.status = :status', { status: InvoiceStatus.PAYEE })
      .andWhere('inv.isDeleted = :isDeleted', { isDeleted: false })
      .getRawOne();

    return { total, paid, pending, totalRevenue: result?.totalRevenue || 0 };
  }
}