import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { User, UserRole } from '../users/user.entity';
import { Invoice, InvoiceType } from '../invoices/invoice.entity';

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
      where: { id: invoiceId, type: InvoiceType.FACTURE, isDeleted: false },
    });
    if (!invoice) {
      throw new BadRequestException('Une tâche ne peut être liée qu’à une facture définitive active.');
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
    if (!assigneeId || String(assigneeId) !== String(user.id)) {
      throw new ForbiddenException('Accès refusé');
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

  async syncInvoiceTask(invoice: Invoice, creatorId: string): Promise<Task | null> {
    if (invoice.type !== InvoiceType.FACTURE || !invoice.deliveryPersonId) return null;

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

  async findAll(user: { id: string; role: UserRole }): Promise<Task[]> {
    const buildQuery = (includeInvoice: boolean) => {
      const qb = this.tasksRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.assignedTo', 'assignedTo')
        .leftJoinAndSelect('task.createdBy', 'createdBy')
        .orderBy('task.createdAt', 'DESC');
      if (includeInvoice) qb.leftJoin('task.invoice', 'invoice').addSelect(['invoice.id', 'invoice.number', 'invoice.type']);
      if (user.role === UserRole.LIVREUR) qb.andWhere('assignedTo.id = :userId', { userId: user.id });
      return qb;
    };

    try {
      return await buildQuery(user.role !== UserRole.LIVREUR).getMany();
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
      if (includeInvoice) qb.leftJoin('task.invoice', 'invoice').addSelect(['invoice.id', 'invoice.number', 'invoice.type']);
      return qb;
    };
    let task: Task | null;
    try {
      task = await buildQuery(user.role !== UserRole.LIVREUR).getOne();
    } catch (error) {
      if (user.role === UserRole.LIVREUR || !this.isMissingInvoiceLinkColumn(error)) throw error;
      task = await buildQuery(false).getOne();
    }

    if (!task) throw new NotFoundException('Tâche non trouvée');
    this.ensureLivreurAccess(task, user);
    return task;
  }

  async update(id: string, dto: any, user: { id: string; role: UserRole }): Promise<Task> {
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
    return this.tasksRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Tâche non trouvée');
  }

  async getLivreurStats(userId: string): Promise<any> {
    const tasks = await this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.assignedTo', 'assignee')
      .where('assignee.id = :userId', { userId })
      .getMany();

    const completed = tasks.filter((t) => t.status === TaskStatus.TERMINEE);
    const totalEarned = completed.reduce((sum, t) => sum + Number(t.finalPrice || t.price), 0);
    return {
      total: tasks.length,
      completed: completed.length,
      pending: tasks.filter((t) => t.status === TaskStatus.EN_ATTENTE).length,
      totalEarned,
    };
  }

  async startDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task> {
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
    return this.tasksRepository.save(task);
  }

  async finishDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task> {
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
    return this.tasksRepository.save(task);
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
