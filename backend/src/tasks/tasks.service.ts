import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { User, UserRole } from '../users/user.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

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

    const task = this.tasksRepository.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      dueDate: dto.dueDate || null,
      deliveryDate: dto.deliveryDate || null,
      clientName: dto.clientName || null,
      clientLogoUrl: dto.clientLogoUrl || null,
      clientAddress: dto.clientAddress || null,
      finalPrice: dto.price,
      createdBy: { id: adminId } as any,
      assignedTo: livreur,
    }) as Task;
    return this.tasksRepository.save(task);
  }

  async findAll(user: { id: string; role: UserRole }): Promise<Task[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .orderBy('task.createdAt', 'DESC');

    if (user.role === UserRole.LIVREUR) {
      qb.andWhere('assignedTo.id = :userId', { userId: user.id });
    }

    return qb.getMany();
  }

  async findOne(id: string, user: { id: string; role: UserRole }): Promise<Task> {
    const task = await this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.id = :id', { id })
      .getOne();

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
