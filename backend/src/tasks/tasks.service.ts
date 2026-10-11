import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { User, UserRole } from '../users/user.entity';
import { Invoice, InvoiceType } from '../invoices/invoice.entity';

type LivreurTask = Omit<Task, 'price' | 'finalPrice' | 'extraFees' | 'extraFeesNote' | 'assignedTo' | 'createdBy' | 'invoice'> & {
  hasDeliveryNote: boolean;
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
    return {
      ...safeTask,
      hasDeliveryNote: invoice?.type === InvoiceType.BON_LIVRAISON
        && invoice.deliveryPersonId === assignedTo?.id,
    };
  }

  presentForLivreur(task: Task): LivreurTask {
    return this.sanitizeLivreurTask(task);
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

  async syncInvoiceTask(invoice: Invoice, creatorId: string): Promise<Task | null> {
    if (![InvoiceType.FACTURE, InvoiceType.BON_LIVRAISON].includes(invoice.type) || !invoice.deliveryPersonId) return null;

    const livreur = await this.usersRepository.findOne({ where: { id: invoice.deliveryPersonId } });
    if (!livreur || livreur.role !== UserRole.LIVREUR || livreur.isActive === false) {
      throw new BadRequestException('Livreur invalide ou introuvable');
    }

    const existingTask = await this.tasksRepository.findOne({
      where: { invoice: { id: invoice.id } },
    });
    const price = Number(invoice.total || 0);
    const task = existingTask || this.tasksRepository.create({
      status: TaskStatus.EN_ATTENTE,
      extraFees: 0,
      createdBy: { id: creatorId } as any,
    });

    task.name = invoice.number;
    task.description = (invoice.items || [])
      .map((item) => `${item.quantity} x ${item.description}`)
      .join('\n');
    task.price = price;
    task.finalPrice = price + Number(task.extraFees || 0);
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
    if (invoice.deliveryPersonId !== user.id) {
      throw new ForbiddenException('Ce bon de livraison n’est pas attribué à ce livreur.');
    }

    return {
      number: invoice.number,
      createdAt: invoice.createdAt,
      deliveryDate: invoice.deliveryDate,
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress,
      clientPhone: invoice.clientPhone,
      clientEmail: invoice.clientEmail,
      items: (invoice.items || []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
      })),
    };
  }

  async update(id: string, dto: any, user: { id: string; role: UserRole }): Promise<Task | LivreurTask> {
    const task = await this.findOne(id, user);

    if (user.role === UserRole.LIVREUR) {
      if (dto.status) task.status = dto.status;
      if (dto.remarks !== undefined) task.remarks = dto.remarks;
      if (dto.status === TaskStatus.TERMINEE) task.completedAt = new Date();
      if (dto.status === TaskStatus.NON_TERMINEE) task.completedAt = new Date();
    } else {
      if (dto.invoiceId !== undefined) task.invoice = await this.resolveLinkedInvoice(dto.invoiceId);
      if (dto.cancelDelivery) {
        task.startedDeliveryAt = null;
        task.finishedDeliveryAt = null;
        task.deliveryDurationMinutes = null;
      }
      if (dto.status) task.status = dto.status;
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
      if (dto.status === TaskStatus.TERMINEE) task.completedAt = new Date();
      if (dto.status === TaskStatus.EN_ATTENTE) task.completedAt = null;
      task.finalPrice = Number(task.price) + Number(task.extraFees || 0);
    }
    const savedTask = await this.tasksRepository.save(task);
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
    return {
      total: tasks.length,
      completed: completed.length,
      pending: tasks.filter((t) => t.status === TaskStatus.EN_ATTENTE).length,
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
    const savedTask = await this.tasksRepository.save(task);
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
    task.finishedDeliveryAt = new Date();
    const diffMs = task.finishedDeliveryAt.getTime() - task.startedDeliveryAt.getTime();
    task.deliveryDurationMinutes = Math.round(diffMs / 60000);
    task.status = TaskStatus.TERMINEE;
    task.completedAt = new Date();
    const savedTask = await this.tasksRepository.save(task);
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
