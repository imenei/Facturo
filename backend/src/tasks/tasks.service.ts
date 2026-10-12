import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { User, UserRole } from '../users/user.entity';
import { DeliveryStatus, Invoice, InvoiceType, WorkflowStep } from '../invoices/invoice.entity';
import { DeliveryGateway } from '../gateway/delivery.gateway';

type LivreurTask = Omit<Task, 'price' | 'finalPrice' | 'extraFees' | 'extraFeesNote' | 'assignedTo' | 'createdBy' | 'invoice'> & {
  hasDeliveryNote: boolean;
  deliveryNoteId?: string;
  deliveryNoteNumber?: string;
  deliveryPrice?: number;
  deliveryStatus?: DeliveryStatus;
};

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    private deliveryGateway: DeliveryGateway,
  ) {}

  private async resolveLinkedInvoice(invoiceId?: string | null): Promise<Invoice | null> {
    if (!invoiceId) return null;
    const invoice = await this.invoicesRepository.findOne({
      where: [
        { id: invoiceId, type: InvoiceType.FACTURE, isDeleted: false },
        { id: invoiceId, type: InvoiceType.BON_LIVRAISON, isDeleted: false },
      ],
    });
    if (!invoice) {
      throw new BadRequestException('Une tâche ne peut être liée qu’à une facture définitive ou un bon de livraison actif.');
    }
    return invoice;
  }

  private getAssigneeId(task: Task): string | null {
    const raw = task as Task & { assignedToId?: string };
    return raw.assignedToId || task.assignedTo?.id || null;
  }

  private ensureLivreurAccess(task: Task, user: { id: string; role: UserRole }): void {
    if (user.role !== UserRole.LIVREUR) return;
    const assigneeId = this.getAssigneeId(task);
    if (
      !assigneeId
      || String(assigneeId) !== String(user.id)
      || task.invoice?.type === InvoiceType.FACTURE
    ) {
      throw new ForbiddenException('Accès refusé');
    }
  }

  private sanitizeLivreurTask(task: Task): LivreurTask {
    const {
      price,
      finalPrice,
      extraFees,
      extraFeesNote,
      assignedTo,
      createdBy,
      invoice,
      ...safeTask
    } = task;
    const isAssignedBl = invoice?.type === InvoiceType.BON_LIVRAISON
      && String(invoice.deliveryPersonId || '') === String(assignedTo?.id || '');
    return {
      ...safeTask,
      hasDeliveryNote: isAssignedBl,
      deliveryNoteId: isAssignedBl ? invoice.id : undefined,
      deliveryNoteNumber: isAssignedBl ? invoice.number : undefined,
      deliveryPrice: isAssignedBl ? Number(invoice.deliveryPrice || 0) : undefined,
      deliveryStatus: isAssignedBl ? invoice.deliveryStatus : undefined,
    };
  }

  presentForLivreur(task: Task): LivreurTask {
    return this.sanitizeLivreurTask(task);
  }

  /** Statut de livraison déduit de l'état d'une tâche. */
  deliveryStatusOfTask(task: Task): DeliveryStatus {
    if (task.status === TaskStatus.TERMINEE) return DeliveryStatus.LIVREE;
    if (task.status === TaskStatus.NON_TERMINEE) return DeliveryStatus.NON_LIVREE;
    return task.startedDeliveryAt ? DeliveryStatus.EN_COURS : DeliveryStatus.EN_ATTENTE;
  }

  /** Vérifie qu'un utilisateur est un livreur actif (à appeler AVANT d'enregistrer un document). */
  async assertAssignableLivreur(userId?: string | null): Promise<User> {
    if (!userId) throw new BadRequestException('Un livreur doit être choisi pour le bon de livraison.');
    const livreur = await this.usersRepository.findOne({ where: { id: userId } });
    if (!livreur || livreur.role !== UserRole.LIVREUR) {
      throw new BadRequestException('Livreur invalide ou introuvable');
    }
    if (livreur.isActive === false) {
      throw new BadRequestException('Ce livreur est désactivé');
    }
    return livreur;
  }

  /** Tâche de livraison rattachée à un document (facture ou bon de livraison). */
  async findTaskByInvoiceId(invoiceId: string): Promise<Task | null> {
    return this.tasksRepository.findOne({
      where: { invoice: { id: invoiceId } },
      relations: { invoice: true, assignedTo: true },
    });
  }

  async assertTaskCanReceiveDeliveryNote(taskId: string, deliveryPersonId: string): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: { invoice: true },
    });
    if (!task) throw new NotFoundException('Tâche de livraison introuvable.');
    if (task.invoice?.type === InvoiceType.BON_LIVRAISON) {
      throw new BadRequestException('Un bon de livraison est déjà associé à cette tâche.');
    }
    if (String(this.getAssigneeId(task)) !== String(deliveryPersonId)) {
      throw new BadRequestException('Le livreur choisi doit être celui qui est assigné à cette tâche.');
    }
  }

  private isMissingInvoiceLinkColumn(error: any): boolean {
    const driverError = error?.driverError || error;
    return driverError?.code === '42703' && /invoiceId/i.test(String(driverError?.message || ''));
  }

  async create(dto: any, adminId: string): Promise<Task> {
    if (!dto.assignedToId) {
      throw new BadRequestException('Un livreur doit être assigné');
    }
    const livreur = await this.usersRepository.findOne({ where: { id: dto.assignedToId } });
    if (!livreur || livreur.role !== UserRole.LIVREUR) {
      throw new BadRequestException('Livreur invalide ou introuvable');
    }
    if (livreur.isActive === false) {
      throw new BadRequestException('Ce livreur est désactivé');
    }
    const invoice = await this.resolveLinkedInvoice(dto.invoiceId);

    const task = this.tasksRepository.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      dueDate: dto.dueDate || null,
      deliveryDate: dto.deliveryDate || null,
      clientName: dto.clientName || null,
      clientLogoUrl: dto.clientLogoUrl || null,
      clientAddress: dto.clientAddress || null,
      clientPhone: dto.clientPhone || null,
      clientEmail: dto.clientEmail || null,
      finalPrice: dto.price,
      createdBy: { id: adminId } as any,
      assignedTo: livreur,
      ...(invoice ? { invoice } : {}),
    }) as Task;
    return this.tasksRepository.save(task);
  }

  async syncInvoiceTask(
    invoice: Invoice,
    creatorId: string,
    taskId?: string,
    sourceInvoiceId?: string,
    initialStatus?: DeliveryStatus,
  ): Promise<Task | null> {
    if (![InvoiceType.FACTURE, InvoiceType.BON_LIVRAISON].includes(invoice.type) || !invoice.deliveryPersonId) return null;

    // Une facture qui possède déjà un bon de livraison ne génère PAS de tâche propre :
    // c'est le bon de livraison qui porte la tâche du livreur (évite les doublons).
    if (invoice.type === InvoiceType.FACTURE) {
      const linkedNote = await this.invoicesRepository.findOne({
        where: { sourceInvoiceId: invoice.id, type: InvoiceType.BON_LIVRAISON, isDeleted: false },
      });
      if (linkedNote) return null;
    }

    const livreur = await this.usersRepository.findOne({ where: { id: invoice.deliveryPersonId } });
    if (!livreur || livreur.role !== UserRole.LIVREUR || livreur.isActive === false) {
      throw new BadRequestException('Livreur invalide ou introuvable');
    }

    let existingTask = taskId
      ? await this.tasksRepository.findOne({ where: { id: taskId }, relations: { invoice: true, assignedTo: true } })
      : await this.tasksRepository.findOne({ where: { invoice: { id: invoice.id } }, relations: { invoice: true, assignedTo: true } });
    if (!existingTask && invoice.type === InvoiceType.BON_LIVRAISON && sourceInvoiceId) {
      existingTask = await this.tasksRepository.findOne({
        where: { invoice: { id: sourceInvoiceId } },
        relations: { invoice: true, assignedTo: true },
      });
    }
    if (taskId && !existingTask) throw new NotFoundException('Tâche de livraison introuvable.');
    // Prix de la tâche : pour un bon de livraison c'est le prix de livraison (ce que touche le livreur),
    // pour une facture on conserve le comportement existant (total du document).
    const price = invoice.type === InvoiceType.BON_LIVRAISON
      ? Number(invoice.deliveryPrice || 0)
      : Number(invoice.total || 0);
    const isNewTask = !existingTask;
    const task = existingTask || this.tasksRepository.create({
      status: TaskStatus.EN_ATTENTE,
      extraFees: 0,
      createdBy: { id: creatorId } as any,
    });
    if (isNewTask && initialStatus && initialStatus !== DeliveryStatus.EN_ATTENTE) {
      this.setTaskDeliveryStatus(task, initialStatus);
    }

    task.name = invoice.number;
    task.description = (invoice.items || [])
      .map((item) => `${item.quantity} x ${item.description}`)
      .join('\n');
    if (!taskId) {
      task.price = price;
      task.finalPrice = price + Number(task.extraFees || 0);
    }
    task.dueDate = null;
    task.deliveryDate = invoice.deliveryDate || null;
    task.clientName = invoice.clientName || null;
    task.clientLogoUrl = invoice.clientLogoUrl || null;
    task.clientAddress = invoice.clientAddress || null;
    task.clientPhone = invoice.clientPhone || null;
    task.clientEmail = invoice.clientEmail || null;
    task.assignedTo = livreur;
    task.invoice = invoice;

    return this.tasksRepository.save(task);
  }

  async findAll(user: { id: string; role: UserRole }): Promise<Array<Task | LivreurTask>> {
    const buildQuery = (includeInvoice: boolean) => {
      const qb = this.tasksRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.assignedTo', 'assignedTo')
        .leftJoinAndSelect('task.createdBy', 'createdBy')
        .orderBy('task.createdAt', 'DESC');
      if (includeInvoice) qb.leftJoinAndSelect('task.invoice', 'invoice');
      if (user.role === UserRole.LIVREUR) {
        qb.andWhere('assignedTo.id = :userId', { userId: user.id })
          .andWhere('(invoice.id IS NULL OR invoice.type != :invoiceType)', { invoiceType: InvoiceType.FACTURE });
      }
      return qb;
    };

    try {
      const tasks = await buildQuery(true).getMany();
      return user.role === UserRole.LIVREUR
        ? tasks.map((task) => this.sanitizeLivreurTask(task))
        : tasks;
    } catch (error) {
      if (user.role === UserRole.LIVREUR || !this.isMissingInvoiceLinkColumn(error)) throw error;
      return buildQuery(false).getMany();
    }
  }

  async findOne(id: string, user: { id: string; role: UserRole }): Promise<Task> {
    const buildQuery = (includeInvoice: boolean) => {
      const qb = this.tasksRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.assignedTo', 'assignedTo')
        .leftJoinAndSelect('task.createdBy', 'createdBy')
        .where('task.id = :id', { id });
      if (includeInvoice) qb.leftJoinAndSelect('task.invoice', 'invoice');
      return qb;
    };
    let task: Task | null;
    try {
      task = await buildQuery(true).getOne();
    } catch (error) {
      if (user.role === UserRole.LIVREUR || !this.isMissingInvoiceLinkColumn(error)) throw error;
      task = await buildQuery(false).getOne();
    }

    if (!task) throw new NotFoundException('Tâche non trouvée');
    this.ensureLivreurAccess(task, user);
    return task;
  }

  async getDeliveryNote(id: string, user: { id: string; role: UserRole }) {
    const task = await this.findOne(id, user);
    const invoiceId = task.invoice?.id;
    if (!invoiceId) {
      throw new NotFoundException('Aucun bon de livraison n’est associé à cette tâche.');
    }

    const invoice = await this.invoicesRepository.findOne({
      where: { id: invoiceId, type: InvoiceType.BON_LIVRAISON, isDeleted: false },
    });
    if (!invoice) {
      throw new NotFoundException('Le bon de livraison associé est introuvable.');
    }
    if (String(invoice.deliveryPersonId) !== String(user.id)) {
      throw new ForbiddenException('Ce bon de livraison n’est pas attribué à ce livreur.');
    }

    return {
      id: invoice.id,
      type: InvoiceType.BON_LIVRAISON,
      number: invoice.number,
      createdAt: invoice.createdAt,
      deliveryDate: invoice.deliveryDate,
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress,
      clientPhone: invoice.clientPhone,
      clientEmail: invoice.clientEmail,
      notes: invoice.notes,
      issuerName: invoice.issuerName,
      issuerNameSize: invoice.issuerNameSize,
      object: (invoice as any).object,
      deliveryPrice: Number(invoice.deliveryPrice || 0),
      deliveryPersonName: invoice.deliveryPersonName,
      deliveryStatus: invoice.deliveryStatus,
      // Même document que celui de l'administrateur : désignations et quantités uniquement,
      // jamais de prix unitaires, de totaux, ni la facture liée.
      items: (invoice.items || []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
      })),
    };
  }

  private setTaskDeliveryStatus(task: Task, status: DeliveryStatus): void {
    const now = new Date();
    if (status === DeliveryStatus.EN_ATTENTE) {
      task.status = TaskStatus.EN_ATTENTE;
      task.startedDeliveryAt = null;
      task.finishedDeliveryAt = null;
      task.deliveryDurationMinutes = null;
      task.completedAt = null;
      return;
    }

    if (status === DeliveryStatus.EN_COURS) {
      task.status = TaskStatus.EN_ATTENTE;
      task.startedDeliveryAt = task.startedDeliveryAt && !task.finishedDeliveryAt ? task.startedDeliveryAt : now;
      task.finishedDeliveryAt = null;
      task.deliveryDurationMinutes = null;
      task.completedAt = null;
      return;
    }

    if (!task.startedDeliveryAt) task.startedDeliveryAt = now;
    task.finishedDeliveryAt = now;
    task.deliveryDurationMinutes = Math.max(
      0,
      Math.round((now.getTime() - task.startedDeliveryAt.getTime()) / 60000),
    );
    task.completedAt = now;
    task.status = status === DeliveryStatus.LIVREE ? TaskStatus.TERMINEE : TaskStatus.NON_TERMINEE;
  }

  /**
   * Propage un statut de LIVRAISON à la facture et au(x) bon(s) de livraison liés.
   * Ne touche jamais au statut de paiement (paymentStatus) ni au statut du document.
   */
  private async applyStatusToLinkedDocuments(
    manager: EntityManager,
    invoice: Invoice,
    status: DeliveryStatus,
    assignee?: { id: string; name: string } | null,
  ): Promise<Invoice[]> {
    const repo = manager.getRepository(Invoice);
    const documents: Invoice[] = [invoice];
    if (invoice.type === InvoiceType.BON_LIVRAISON && invoice.sourceInvoiceId) {
      const source = await repo.findOne({
        where: { id: invoice.sourceInvoiceId, type: InvoiceType.FACTURE, isDeleted: false },
      });
      if (source) documents.push(source);
    } else if (invoice.type === InvoiceType.FACTURE) {
      const notes = await repo.find({
        where: { sourceInvoiceId: invoice.id, type: InvoiceType.BON_LIVRAISON, isDeleted: false },
      });
      documents.push(...notes);
    }

    for (const doc of documents) {
      doc.deliveryStatus = status;
      if (assignee) {
        doc.deliveryPersonId = assignee.id;
        doc.deliveryPersonName = assignee.name;
      }
      // Étape de workflow : la livraison démarre l'étape « livraison » (jamais au-delà).
      if (status !== DeliveryStatus.EN_ATTENTE && doc.workflowStep === WorkflowStep.COMMANDE) {
        doc.workflowStep = WorkflowStep.LIVRAISON;
      } else if (status === DeliveryStatus.EN_ATTENTE && doc.workflowStep === WorkflowStep.LIVRAISON) {
        doc.workflowStep = WorkflowStep.COMMANDE;
      }
    }
    await repo.save(documents);
    return documents;
  }

  private emitDeliveryChange(
    task: Task | null,
    invoice: Invoice | null,
    linkedIds: string[],
    status: DeliveryStatus,
    actorId?: string,
  ): void {
    if (!task && !invoice) return;
    this.deliveryGateway.emitDeliveryStatusUpdated(task?.id || invoice!.id, {
      invoiceId: invoice?.id,
      linkedInvoiceIds: linkedIds,
      number: invoice?.number || task?.name,
      clientName: task?.clientName || invoice?.clientName,
      status,
      livreurId: task ? this.getAssigneeId(task) : invoice?.deliveryPersonId,
      actorId,
    });
  }

  private async saveTaskDeliveryState(task: Task, status: DeliveryStatus, actorId?: string): Promise<Task> {
    const { savedTask, invoice, linkedIds } = await this.tasksRepository.manager.transaction(async (manager) => {
      const persistedTask = await manager.save(Task, task);
      let linkedInvoice: Invoice | null = null;
      let ids: string[] = [];
      const invoiceId = task.invoice?.id;
      if (invoiceId) {
        const found = await manager.getRepository(Invoice).findOne({
          where: { id: invoiceId, isDeleted: false },
        });
        if (found && found.type !== InvoiceType.PROFORMA) {
          // Le livreur de la tâche fait foi : on aligne le bon de livraison (et la facture liée).
          const assignee = task.assignedTo && String(found.deliveryPersonId || '') !== String(task.assignedTo.id)
            ? { id: task.assignedTo.id, name: task.assignedTo.name }
            : null;
          const documents = await this.applyStatusToLinkedDocuments(manager, found, status, assignee);
          linkedInvoice = found;
          ids = documents.map((doc) => doc.id);
        }
      }
      return { savedTask: persistedTask, invoice: linkedInvoice, linkedIds: ids };
    });

    this.emitDeliveryChange(savedTask, invoice, linkedIds, status, actorId);
    return savedTask;
  }

  async applyInvoiceDeliveryStatus(invoiceId: string, status: DeliveryStatus, actorId?: string): Promise<void> {
    const validStatuses = Object.values(DeliveryStatus);
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Statut de livraison invalide.');
    }

    const { invoice, task, linkedIds } = await this.tasksRepository.manager.transaction(async (manager) => {
      const invoiceRepository = manager.getRepository(Invoice);
      const found = await invoiceRepository.findOne({
        where: { id: invoiceId, isDeleted: false },
      });
      if (!found) throw new NotFoundException('Facture non trouvée');
      if (found.type === InvoiceType.PROFORMA) {
        throw new BadRequestException('Une proforma ne peut pas recevoir de statut de livraison.');
      }

      // Facture <-> bon de livraison : le statut de livraison est partagé, le paiement ne l'est pas.
      const documents = await this.applyStatusToLinkedDocuments(manager, found, status);

      const taskRepository = manager.getRepository(Task);
      const linkedTask = await taskRepository.findOne({
        where: { invoice: { id: In(documents.map((doc) => doc.id)) } },
        relations: { invoice: true, assignedTo: true },
      });
      if (linkedTask) {
        this.setTaskDeliveryStatus(linkedTask, status);
        await taskRepository.save(linkedTask);
      }
      return { invoice: found, task: linkedTask, linkedIds: documents.map((doc) => doc.id) };
    });

    this.emitDeliveryChange(task, invoice, linkedIds, status, actorId);
  }

  async update(id: string, dto: any, user: { id: string; role: UserRole }): Promise<Task | LivreurTask> {
    const task = await this.findOne(id, user);

    if (user.role === UserRole.LIVREUR) {
      if (dto.status !== undefined) {
        if (!Object.values(TaskStatus).includes(dto.status)) {
          throw new BadRequestException('Statut de tâche invalide.');
        }
        task.status = dto.status;
      }
      if (dto.remarks !== undefined) task.remarks = dto.remarks;
      if (dto.status === TaskStatus.TERMINEE) this.setTaskDeliveryStatus(task, DeliveryStatus.LIVREE);
      if (dto.status === TaskStatus.NON_TERMINEE) this.setTaskDeliveryStatus(task, DeliveryStatus.NON_LIVREE);
      if (dto.status === TaskStatus.EN_ATTENTE) this.setTaskDeliveryStatus(task, DeliveryStatus.EN_ATTENTE);
    } else {
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.COMMERCIAL) {
        throw new ForbiddenException('Accès refusé');
      }
      if (dto.invoiceId !== undefined) task.invoice = await this.resolveLinkedInvoice(dto.invoiceId);
      if (dto.cancelDelivery) {
        task.startedDeliveryAt = null;
        task.finishedDeliveryAt = null;
        task.deliveryDurationMinutes = null;
      }
      if (dto.status !== undefined) {
        if (!Object.values(TaskStatus).includes(dto.status)) {
          throw new BadRequestException('Statut de tâche invalide.');
        }
        task.status = dto.status;
      }
      if (dto.remarks !== undefined) task.remarks = dto.remarks;
      if (dto.name) task.name = dto.name;
      if (dto.description !== undefined) task.description = dto.description;
      if (dto.price !== undefined) task.price = dto.price;
      if (dto.assignedToId) {
        const livreur = await this.usersRepository.findOne({ where: { id: dto.assignedToId } });
        if (!livreur || livreur.role !== UserRole.LIVREUR) {
          throw new BadRequestException('Livreur invalide');
        }
        task.assignedTo = livreur;
      }
      if (dto.status === TaskStatus.TERMINEE) this.setTaskDeliveryStatus(task, DeliveryStatus.LIVREE);
      if (dto.status === TaskStatus.NON_TERMINEE) this.setTaskDeliveryStatus(task, DeliveryStatus.NON_LIVREE);
      if (dto.status === TaskStatus.EN_ATTENTE || dto.cancelDelivery) {
        this.setTaskDeliveryStatus(task, DeliveryStatus.EN_ATTENTE);
      }
      task.finalPrice = Number(task.price) + Number(task.extraFees || 0);
    }
    const deliveryStatus = task.status === TaskStatus.TERMINEE
      ? DeliveryStatus.LIVREE
      : task.status === TaskStatus.NON_TERMINEE
        ? DeliveryStatus.NON_LIVREE
        : task.startedDeliveryAt
          ? DeliveryStatus.EN_COURS
          : DeliveryStatus.EN_ATTENTE;
    const savedTask = await this.saveTaskDeliveryState(task, deliveryStatus, user.id);
    return user.role === UserRole.LIVREUR
      ? this.sanitizeLivreurTask(savedTask)
      : savedTask;
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Tâche non trouvée');
  }

  async getLivreurStats(userId: string): Promise<any> {
    const tasks = await this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.assignedTo', 'assignee')
      .leftJoin('task.invoice', 'invoice')
      .where('assignee.id = :userId', { userId })
      .andWhere('(invoice.id IS NULL OR invoice.type != :invoiceType)', { invoiceType: InvoiceType.FACTURE })
      .getMany();

    const completed = tasks.filter((t) => t.status === TaskStatus.TERMINEE);
    const notCompleted = tasks.filter((t) => t.status === TaskStatus.NON_TERMINEE);
    const inProgress = tasks.filter((t) => t.status === TaskStatus.EN_ATTENTE && t.startedDeliveryAt && !t.finishedDeliveryAt);
    const pending = tasks.filter((t) => t.status === TaskStatus.EN_ATTENTE && !t.startedDeliveryAt);
    return {
      total: tasks.length,
      completed: completed.length,
      notCompleted: notCompleted.length,
      pending: pending.length,
      inProgress: inProgress.length,
    };
  }

  async startDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task | LivreurTask> {
    const task = await this.findOne(id, user);
    if (task.startedDeliveryAt && !task.finishedDeliveryAt) {
      throw new BadRequestException('La livraison est déjà démarrée');
    }
    if (task.finishedDeliveryAt) {
      throw new BadRequestException('La livraison est déjà terminée');
    }
    task.startedDeliveryAt = new Date();
    task.finishedDeliveryAt = null;
    task.deliveryDurationMinutes = null;
    task.status = TaskStatus.EN_ATTENTE;
    task.completedAt = null;
    const savedTask = await this.saveTaskDeliveryState(task, DeliveryStatus.EN_COURS, user.id);
    return user.role === UserRole.LIVREUR
      ? this.sanitizeLivreurTask(savedTask)
      : savedTask;
  }

  async finishDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task | LivreurTask> {
    const task = await this.findOne(id, user);
    if (!task.startedDeliveryAt) {
      throw new BadRequestException('La livraison n\'a pas encore été démarrée');
    }
    if (task.finishedDeliveryAt) {
      throw new BadRequestException('La livraison est déjà terminée');
    }
    this.setTaskDeliveryStatus(task, DeliveryStatus.LIVREE);
    const savedTask = await this.saveTaskDeliveryState(task, DeliveryStatus.LIVREE, user.id);
    return user.role === UserRole.LIVREUR
      ? this.sanitizeLivreurTask(savedTask)
      : savedTask;
  }

  async reopenDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task | LivreurTask> {
    const task = await this.findOne(id, user);
    if (task.status !== TaskStatus.TERMINEE && task.status !== TaskStatus.NON_TERMINEE && !task.finishedDeliveryAt) {
      throw new BadRequestException('Seule une livraison terminée peut être rouverte.');
    }
    this.setTaskDeliveryStatus(task, DeliveryStatus.EN_COURS);
    const savedTask = await this.saveTaskDeliveryState(task, DeliveryStatus.EN_COURS, user.id);
    return user.role === UserRole.LIVREUR
      ? this.sanitizeLivreurTask(savedTask)
      : savedTask;
  }

  async addExtraFees(id: string, dto: { extraFees: number; extraFeesNote?: string }): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tâche non trouvée');
    task.extraFees = dto.extraFees;
    task.extraFeesNote = dto.extraFeesNote || null;
    task.finalPrice = Number(task.price) + Number(dto.extraFees);
    return this.tasksRepository.save(task);
  }

  async getTasksByLivreur(livreurId: string, from?: string, to?: string): Promise<Task[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('assignedTo.id = :livreurId', { livreurId })
      .orderBy('task.createdAt', 'DESC');

    if (from) qb.andWhere('task.createdAt >= :from', { from: new Date(from) });
    if (to) qb.andWhere('task.createdAt <= :to', { to: new Date(to + 'T23:59:59') });

    return qb.getMany();
  }
}
