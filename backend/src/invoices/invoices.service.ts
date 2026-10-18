import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common'; // ✅ CONVERT : ConflictException
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Invoice, InvoiceAdjustmentType, InvoiceType, InvoiceStatus, DeliveryStatus, PaymentStatus, WorkflowStep } from './invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserRole } from '../users/user.entity';
import { DeliveryGateway } from '../gateway/delivery.gateway';
import { InvoiceDeletionRequest, DeletionRequestStatus } from './invoice-deletion-request.entity';
import { UsersService } from '../users/users.service';
import { TasksService } from '../tasks/tasks.service';
import { roundMoney, computeNetProfit, parseDateOnly } from '../common/money';

/** Échappe les caractères spéciaux d'un motif LIKE (% _ \\). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(InvoiceDeletionRequest)
    private deletionRequestsRepository: Repository<InvoiceDeletionRequest>,
    private deliveryGateway: DeliveryGateway,
    private usersService: UsersService,
    private tasksService: TasksService,
    private dataSource: DataSource,
  ) {}

  // Verrou mémoire : empêche deux créations simultanées (double clic) d'un bon de livraison
  // pour la même facture.
  private readonly deliveryNotesBeingCreated = new Set<string>();

  /**
   * Chaque article saisi dans une facture / proforma est automatiquement ajouté à la liste des produits
   * (s'il n'existe pas déjà, sans tenir compte des majuscules). Un produit existant n'est jamais écrasé ;
   * un produit désactivé qui est de nouveau facturé est réactivé. Une erreur ici ne bloque jamais la facture.
   */
  private async syncProductsFromItems(
    items: Array<{ description?: string; unitPrice?: number; purchasePrice?: number }> | undefined,
  ): Promise<void> {
    try {
      const seen = new Set<string>();
      for (const item of items || []) {
        const name = String(item?.description || '').trim();
        if (!name || name.length > 255) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const existing = await this.productsRepository
          .createQueryBuilder('product')
          .where('LOWER(product.name) = :key', { key })
          .orderBy('product.isActive', 'DESC')
          .getOne();

        if (existing) {
          if (!existing.isActive) {
            existing.isActive = true;
            await this.productsRepository.save(existing);
          }
          continue;
        }
        await this.productsRepository.save(
          this.productsRepository.create({
            name,
            purchasePrice: roundMoney(item.purchasePrice ?? 0),
            salePrice: roundMoney(item.unitPrice ?? 0),
            isActive: true,
          }),
        );
      }
    } catch (error) {
      console.error('[invoices] synchronisation des produits impossible :', (error as Error)?.message);
    }
  }

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
    items: Array<{ unitPrice: number; quantity: number }>,
    hasTva: boolean,
    tvaRate: number,
    adjustmentType: InvoiceAdjustmentType,
    adjustmentPercent: number,
    additionalCharges = 0,
  ) {
    const normalizedPercent = Math.min(Math.max(Number(adjustmentPercent) || 0, 0), 100);
    const adjustedItems = items.map((item) => {
      const unitPrice = roundMoney(item.unitPrice);
      const quantity = Number(item.quantity) || 0;
      const unitAdjustment = roundMoney((unitPrice * normalizedPercent) / 100);
      const adjustedUnitPrice = roundMoney(
        unitPrice + (adjustmentType === InvoiceAdjustmentType.ADDITION ? unitAdjustment : -unitAdjustment),
      );
      const originalTotal = roundMoney(unitPrice * quantity);
      const adjustedTotal = roundMoney(adjustedUnitPrice * quantity);
      return { originalTotal, adjustedTotal };
    });
    const adjustmentAmount = roundMoney(adjustedItems.reduce(
      (sum, item) => sum + Math.abs(item.adjustedTotal - item.originalTotal),
      0,
    ));
    const adjustedSubtotal = roundMoney(adjustedItems.reduce((sum, item) => sum + item.adjustedTotal, 0));
    // Les « autres charges » sont des dépenses INTERNES : elles ne sont ni facturées ni affichées,
    // donc ni dans le sous-total ni dans la base de TVA (TVA = chiffre d'affaires × taux).
    void additionalCharges;
    const subtotalWithCharges = roundMoney(adjustedSubtotal);
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
    const lockKey = dto.type === InvoiceType.BON_LIVRAISON && dto.sourceInvoiceId ? dto.sourceInvoiceId : null;
    if (lockKey) {
      if (this.deliveryNotesBeingCreated.has(lockKey)) {
        throw new BadRequestException('La création du bon de livraison de cette facture est déjà en cours.');
      }
      this.deliveryNotesBeingCreated.add(lockKey);
    }
    try {
      return await this.createInternal(dto, userId);
    } finally {
      if (lockKey) this.deliveryNotesBeingCreated.delete(lockKey);
    }
  }

  private async createInternal(dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    try {
      const sourceInvoice = dto.sourceInvoiceId
        ? await this.invoicesRepository.findOne({ where: { id: dto.sourceInvoiceId, isDeleted: false } })
        : null;
      if (dto.sourceInvoiceId && (!sourceInvoice || sourceInvoice.type !== InvoiceType.FACTURE)) {
        throw new BadRequestException('Un bon de livraison ne peut provenir que d’une facture définitive active.');
      }
      // Un bon de livraison créé depuis une facture reprend son livreur si aucun n'est précisé.
      const deliveryPersonId = dto.deliveryPersonId
        || (dto.type === InvoiceType.BON_LIVRAISON ? sourceInvoice?.deliveryPersonId : undefined)
        || undefined;
      if (dto.type === InvoiceType.BON_LIVRAISON) {
        if (!deliveryPersonId) {
          throw new BadRequestException('Un livreur doit être choisi pour le bon de livraison.');
        }
        if (dto.sourceInvoiceId) {
          const existingBl = await this.invoicesRepository.findOne({
            where: {
              sourceInvoiceId: dto.sourceInvoiceId,
              type: InvoiceType.BON_LIVRAISON,
              isDeleted: false,
            },
          });
          if (existingBl) {
            throw new BadRequestException('Un bon de livraison existe déjà pour cette facture.');
          }
        }
      }
      // Le livreur est vérifié AVANT l'enregistrement : on évite ainsi un document créé
      // sans tâche (livreur invalide / désactivé) qui serait ensuite recréé en doublon.
      if (deliveryPersonId) {
        await this.tasksService.assertAssignableLivreur(deliveryPersonId);
      }
      if (dto.taskId) {
        if (dto.type !== InvoiceType.BON_LIVRAISON) {
          throw new BadRequestException('Une tâche ne peut être liée qu’à un bon de livraison.');
        }
        await this.tasksService.assertTaskCanReceiveDeliveryNote(dto.taskId, deliveryPersonId as string);
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
      const otherCharges = (dto.otherCharges || []).map((charge) => ({
        description: charge.description.trim(),
        amount: roundMoney(charge.amount),
      })).filter((charge) => charge.description || charge.amount > 0);
      const additionalCharges = roundMoney(otherCharges.reduce((sum, charge) => sum + charge.amount, 0));
      const adjustmentType = dto.adjustmentType || InvoiceAdjustmentType.DISCOUNT;
      const adjustmentPercent = dto.adjustmentPercent ?? dto.discountPercent ?? 0;
      const totals = this.calculateInvoiceTotals(resolvedItems, Boolean(dto.hasTva), Number(dto.tvaRate || 19), adjustmentType, adjustmentPercent, additionalCharges);
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
      const otherCharge = otherCharges.length > 0 ? additionalCharges : roundMoney(dto.otherCharge ?? 0);
      const deliveryPrice = roundMoney(
        dto.deliveryPrice ?? (dto.type === InvoiceType.BON_LIVRAISON ? sourceInvoice?.deliveryPrice : 0) ?? 0,
      );
      const delivery = await this.resolveDeliveryPerson(deliveryPersonId);
      // Un bon de livraison hérite du statut de livraison de sa facture.
      const inheritedDeliveryStatus = dto.type === InvoiceType.BON_LIVRAISON && sourceInvoice
        ? sourceInvoice.deliveryStatus
        : DeliveryStatus.EN_ATTENTE;
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
        deliveryStatus: inheritedDeliveryStatus,
        // Un bon de livraison garde l'identité société de sa facture (jamais le nom par défaut des réglages).
        issuerName: dto.issuerName || (dto.type === InvoiceType.BON_LIVRAISON ? sourceInvoice?.issuerName : undefined) || undefined,
        workflowStep: inheritedDeliveryStatus === DeliveryStatus.EN_ATTENTE ? WorkflowStep.COMMANDE : WorkflowStep.LIVRAISON,
        netProfit: computeNetProfit(
          totalMargin + (adjustmentType === InvoiceAdjustmentType.ADDITION ? totals.adjustmentAmount : -totals.adjustmentAmount),
          otherCharge,
          deliveryPrice,
        ),
        issuerNameSize: dto.issuerNameSize ?? (dto.type === InvoiceType.BON_LIVRAISON ? sourceInvoice?.issuerNameSize : undefined) ?? 16,
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
      if (savedInvoice.type === InvoiceType.FACTURE || savedInvoice.type === InvoiceType.PROFORMA) {
        await this.syncProductsFromItems(items);
      }
      const task = await this.tasksService.syncInvoiceTask(
        savedInvoice, userId, dto.taskId, sourceInvoice?.id, savedInvoice.deliveryStatus,
      );
      if (task && savedInvoice.type === InvoiceType.BON_LIVRAISON && savedInvoice.deliveryPersonId) {
        this.deliveryGateway.emitTaskAssigned(
          savedInvoice.deliveryPersonId,
          this.tasksService.presentForLivreur(task),
        );
      }
      // Le bon de livraison est lié à sa facture : prix de livraison et livreur sont reportés
      // sur la facture (la marge / bénéfice net n'est calculée que sur les factures).
      if (savedInvoice.type === InvoiceType.BON_LIVRAISON && sourceInvoice) {
        await this.mirrorDeliveryFields(savedInvoice, userId, { price: true, person: true });
      }
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
        // Recherche « commence par » : une lettre affiche tous les clients dont le nom commence par cette lettre.
        qb.andWhere('LOWER(inv.clientName) LIKE :client', { client: `${escapeLike(filters.client.trim().toLowerCase())}%` });
      }
      if (filters?.number) {
        // Numéro : commence par la saisie (« f » → FAC-…) ou l'un de ses segments (« 0029 » → FAC-2026-0029).
        const numberTerm = escapeLike(filters.number.trim().toUpperCase());
        qb.andWhere('(UPPER(inv.number) LIKE :numberStart OR UPPER(inv.number) LIKE :numberSegment)', {
          numberStart: `${numberTerm}%`,
          numberSegment: `%-${numberTerm}%`,
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

  /**
   * Détail d'un document avec ses liens :
   *  - bon de livraison -> facture d'origine (`sourceInvoice`) + tâche de livraison (`deliveryTask`)
   *  - facture          -> bon de livraison lié (`deliveryNote`)
   */
  async findOneDetailed(id: string, user: { id: string; role: UserRole }): Promise<any> {
    const invoice = await this.findOne(id, user);
    const result: any = { ...invoice };

    if (invoice.type === InvoiceType.BON_LIVRAISON) {
      if (invoice.sourceInvoiceId) {
        const source = await this.invoicesRepository.findOne({ where: { id: invoice.sourceInvoiceId } });
        result.sourceInvoice = source
          ? {
              id: source.id,
              number: source.number,
              status: source.status,
              paymentStatus: source.paymentStatus,
              isDeleted: source.isDeleted,
            }
          : null;
      }
      const task = await this.tasksService.findTaskByInvoiceId(invoice.id);
      result.deliveryTask = task
        ? {
            id: task.id,
            status: task.status,
            startedDeliveryAt: task.startedDeliveryAt,
            finishedDeliveryAt: task.finishedDeliveryAt,
            deliveryDurationMinutes: task.deliveryDurationMinutes,
            remarks: task.remarks,
          }
        : null;
    }

    if (invoice.type === InvoiceType.FACTURE) {
      const note = await this.invoicesRepository.findOne({
        where: { sourceInvoiceId: invoice.id, type: InvoiceType.BON_LIVRAISON, isDeleted: false },
        order: { createdAt: 'DESC' },
      });
      result.deliveryNote = note
        ? {
            id: note.id,
            number: note.number,
            deliveryStatus: note.deliveryStatus,
            deliveryPersonName: note.deliveryPersonName,
            deliveryPrice: note.deliveryPrice,
          }
        : null;
    }
    return result;
  }

  private recomputeNetProfit(invoice: Invoice): number {
    const adjustmentImpact = invoice.adjustmentType === InvoiceAdjustmentType.ADDITION
      ? Number(invoice.adjustmentAmount || 0)
      : -Number(invoice.adjustmentAmount || 0);
    return computeNetProfit(
      Number(invoice.totalMargin || 0) + adjustmentImpact,
      Number(invoice.otherCharge || 0),
      Number(invoice.deliveryPrice || 0),
    );
  }

  /**
   * Garde la facture et son bon de livraison cohérents sur les champs de livraison
   * (prix de livraison, livreur). Seuls les champs réellement modifiés sont reportés,
   * et un bon de livraison ne perd jamais son livreur.
   */
  private async mirrorDeliveryFields(
    source: Invoice,
    userId: string,
    fields: { price?: boolean; person?: boolean },
  ): Promise<void> {
    let counterpart: Invoice | null = null;
    if (source.type === InvoiceType.BON_LIVRAISON && source.sourceInvoiceId) {
      counterpart = await this.invoicesRepository.findOne({
        where: { id: source.sourceInvoiceId, type: InvoiceType.FACTURE, isDeleted: false },
      });
    } else if (source.type === InvoiceType.FACTURE) {
      counterpart = await this.invoicesRepository.findOne({
        where: { sourceInvoiceId: source.id, type: InvoiceType.BON_LIVRAISON, isDeleted: false },
      });
    }
    if (!counterpart) return;

    let changed = false;
    if (fields.price && roundMoney(counterpart.deliveryPrice) !== roundMoney(source.deliveryPrice)) {
      counterpart.deliveryPrice = roundMoney(source.deliveryPrice);
      changed = true;
    }
    if (fields.person && source.deliveryPersonId && counterpart.deliveryPersonId !== source.deliveryPersonId) {
      counterpart.deliveryPersonId = source.deliveryPersonId;
      counterpart.deliveryPersonName = source.deliveryPersonName;
      changed = true;
    }
    if (!changed) return;

    counterpart.netProfit = this.recomputeNetProfit(counterpart);
    const saved = await this.invoicesRepository.save(counterpart);

    if (saved.type === InvoiceType.BON_LIVRAISON) {
      const task = await this.tasksService.syncInvoiceTask(saved, userId, undefined, saved.sourceInvoiceId);
      if (task && saved.deliveryPersonId) {
        this.deliveryGateway.emitTaskAssigned(saved.deliveryPersonId, this.tasksService.presentForLivreur(task));
      }
    }
  }

  // ✅ CONVERT : méthode ajoutée
  /**
   * Convertit une proforma en facture : la proforma est conservée, une NOUVELLE facture
   * (nouveau numéro FAC-…) est créée avec les mêmes client, articles, remises et TVA.
   */
  async convertProformaToFacture(id: string, user: { id: string; role: UserRole }): Promise<Invoice> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.COMMERCIAL) {
      throw new ForbiddenException('Accès refusé');
    }

    // Verrou anti double-clic (même principe que pour les bons de livraison)
    const lockKey = `convert-${id}`;
    if (this.deliveryNotesBeingCreated.has(lockKey)) {
      throw new BadRequestException('La conversion de cette proforma est déjà en cours.');
    }
    this.deliveryNotesBeingCreated.add(lockKey);

    try {
      const proforma = await this.findOne(id, user); // 404 si supprimée / introuvable
      if (proforma.type !== InvoiceType.PROFORMA) {
        throw new BadRequestException("Ce document n'est pas une proforma.");
      }

      const existing = await this.invoicesRepository.findOne({
        where: { sourceInvoiceId: proforma.id, type: InvoiceType.FACTURE, isDeleted: false },
      });
      if (existing) {
        throw new ConflictException(`Cette proforma est déjà convertie en facture ${existing.number}.`);
      }

      // Une date de livraison passée bloquerait la future modification de la facture.
      const today = new Date().toISOString().slice(0, 10);
      const deliveryDate = proforma.deliveryDate && new Date(proforma.deliveryDate).toISOString().slice(0, 10) >= today
        ? proforma.deliveryDate
        : null;

      const facture = this.invoicesRepository.create({
        type: InvoiceType.FACTURE,
        status: InvoiceStatus.BROUILLON, // ← mets InvoiceStatus.EMISE pour qu'elle compte tout de suite dans le dashboard
        number: await this.generateNumber(InvoiceType.FACTURE),
        sourceInvoiceId: proforma.id,

        clientName: proforma.clientName,
        clientEmail: proforma.clientEmail || null,
        clientPhone: proforma.clientPhone || null,
        clientAddress: proforma.clientAddress || null,
        clientNif: proforma.clientNif || null,
        clientNis: proforma.clientNis || null,
        clientLogoUrl: proforma.clientLogoUrl || null,
        clientId: proforma.clientId,

        items: (proforma.items || []).map((item: any) => ({ ...item })),
        subtotal: proforma.subtotal,
        discountPercent: proforma.discountPercent,
        discountAmount: proforma.discountAmount,
        adjustmentType: proforma.adjustmentType,
        adjustmentPercent: proforma.adjustmentPercent,
        adjustmentAmount: proforma.adjustmentAmount,
        hasTva: proforma.hasTva,
        tvaRate: proforma.tvaRate,
        tvaAmount: proforma.tvaAmount,
        total: proforma.total,

        totalMargin: proforma.totalMargin,
        otherCharge: proforma.otherCharge,
        otherCharges: proforma.otherCharges,
        deliveryPrice: proforma.deliveryPrice,
        deliveryPersonId: proforma.deliveryPersonId,
        deliveryPersonName: proforma.deliveryPersonName,
        netProfit: proforma.netProfit,

        issuerName: proforma.issuerName,
        issuerNameSize: proforma.issuerNameSize,
        templateType: proforma.templateType,
        notes: proforma.notes,
        dueDate: proforma.dueDate,
        deliveryDate,

        paymentStatus: PaymentStatus.UNPAID,
        deliveryStatus: DeliveryStatus.EN_ATTENTE,
        workflowStep: WorkflowStep.COMMANDE,
        createdBy: { id: user.id } as any,
      });

      const saved = await this.invoicesRepository.save(facture);
      await this.tasksService.syncInvoiceTask(saved, user.id, undefined, undefined, saved.deliveryStatus);
      return saved;
    } finally {
      this.deliveryNotesBeingCreated.delete(lockKey);
    }
  }

  async update(id: string, dto: UpdateInvoiceDto, user: { id: string; role: UserRole }): Promise<Invoice> {
    const invoice = await this.findOne(id, user);
    invoice.lastModifiedBy = { id: user.id } as any;
    // Valeurs de livraison avant modification : on ne reporte sur le document lié que ce qui change
    // réellement (le formulaire d'édition renvoie toujours ces champs, même inchangés).
    const previousDeliveryPrice = roundMoney(invoice.deliveryPrice);
    const previousDeliveryPersonId = invoice.deliveryPersonId || null;

    const effectiveReferenceDate = invoice.createdAt ?? new Date();
    this.validateDeliveryDate(effectiveReferenceDate, dto.deliveryDate ?? invoice.deliveryDate ?? null);

    // ✅ CONVERT : le type ne peut plus être changé par l'édition : une proforma devient facture
    // uniquement via la conversion (nouveau numéro FAC-…).
    if (dto.type !== undefined && dto.type !== invoice.type) {
      throw new BadRequestException('Le type du document ne peut pas être modifié. Utilisez « Convertir en facture ».');
    }
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
      const additionalCharges = roundMoney((invoice.otherCharges || []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
      const totals = this.calculateInvoiceTotals(invoice.items, Boolean(invoice.hasTva), Number(invoice.tvaRate || 19), invoice.adjustmentType || InvoiceAdjustmentType.DISCOUNT, Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0), additionalCharges);
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
      if (invoice.type === InvoiceType.BON_LIVRAISON && !dto.deliveryPersonId) {
        throw new BadRequestException('Un livreur doit rester affecté au bon de livraison.');
      }
      if (dto.deliveryPersonId && dto.deliveryPersonId !== invoice.deliveryPersonId) {
        await this.tasksService.assertAssignableLivreur(dto.deliveryPersonId);
      }
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
      const totals = this.calculateInvoiceTotals(items, hasTva, tvaRate, invoice.adjustmentType || InvoiceAdjustmentType.DISCOUNT, Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0), additionalCharges);
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
      const additionalCharges = roundMoney((invoice.otherCharges || []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
      const totals = this.calculateInvoiceTotals(invoice.items, hasTva, tvaRate, invoice.adjustmentType || InvoiceAdjustmentType.DISCOUNT, Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0), additionalCharges);
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
      Number(invoice.totalMargin || 0) + (invoice.adjustmentType === InvoiceAdjustmentType.ADDITION ? Number(invoice.adjustmentAmount || 0) : -Number(invoice.adjustmentAmount || 0)),
      Number(invoice.otherCharge || 0),
      Number(invoice.deliveryPrice || 0),
    );

    const savedInvoice = await this.invoicesRepository.save(invoice);
    if (dto.items !== undefined && (savedInvoice.type === InvoiceType.FACTURE || savedInvoice.type === InvoiceType.PROFORMA)) {
      await this.syncProductsFromItems(savedInvoice.items);
    }
    const task = await this.tasksService.syncInvoiceTask(savedInvoice, user.id, undefined, savedInvoice.sourceInvoiceId);
    if (task && savedInvoice.type === InvoiceType.BON_LIVRAISON && savedInvoice.deliveryPersonId) {
      this.deliveryGateway.emitTaskAssigned(
        savedInvoice.deliveryPersonId,
        this.tasksService.presentForLivreur(task),
      );
    }
    // Facture <-> bon de livraison : on ne reporte que ce qui vient d'être modifié.
    const priceChanged = dto.deliveryPrice !== undefined && roundMoney(dto.deliveryPrice) !== previousDeliveryPrice;
    const personChanged = dto.deliveryPersonId !== undefined
      && (dto.deliveryPersonId || null) !== previousDeliveryPersonId;
    if (priceChanged || personChanged) {
      await this.mirrorDeliveryFields(savedInvoice, user.id, { price: priceChanged, person: personChanged });
    }
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

  async updateDeliveryStatus(id: string, status: DeliveryStatus, actorId?: string): Promise<Invoice> {
    if (!Object.values(DeliveryStatus).includes(status)) {
      throw new BadRequestException('Statut de livraison invalide.');
    }
    // Le statut de livraison est synchronisé entre la facture, son bon de livraison et la tâche
    // du livreur (et diffusé en temps réel). Le statut de paiement n'est jamais modifié ici.
    await this.tasksService.applyInvoiceDeliveryStatus(id, status, actorId);
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    return invoice;
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
