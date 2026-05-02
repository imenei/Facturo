import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { UserRole } from '../users/user.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async create(dto: any, adminId: string): Promise<Task> {
    const task = this.tasksRepository.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      dueDate: dto.dueDate || null,
      deliveryDate: dto.deliveryDate || null,
      clientName: dto.clientName || null,
      clientLogoUrl: dto.clientLogoUrl || null,
      clientAddress: dto.clientAddress || null,
      finalPrice: dto.price, // initially same as price
      createdBy: { id: adminId } as any,
      assignedTo: { id: dto.assignedToId } as any,
    }) as Task;
    return this.tasksRepository.save(task);
  }

  async findAll(user: { id: string; role: UserRole }): Promise<Task[]> {
    if (user.role === UserRole.ADMIN) {
      return this.tasksRepository.find({ order: { createdAt: 'DESC' }, relations: ['assignedTo', 'createdBy'] });
    }
    return this.tasksRepository.find({
      where: { assignedTo: { id: user.id } },
      order: { createdAt: 'DESC' },
      relations: ['assignedTo', 'createdBy'],
    });
  }

  async findOne(id: string, user: { id: string; role: UserRole }): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id }, relations: ['assignedTo', 'createdBy'] });
    if (!task) throw new NotFoundException('Tâche non trouvée');
    if (user.role === UserRole.LIVREUR && task.assignedTo.id !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }
    return task;
  }

  async update(id: string, dto: any, user: { id: string; role: UserRole }): Promise<Task> {
    const task = await this.findOne(id, user);
    if (user.role === UserRole.LIVREUR) {
      if (dto.status) task.status = dto.status;
      if (dto.remarks !== undefined) task.remarks = dto.remarks;
      if (dto.status === TaskStatus.TERMINEE) task.completedAt = new Date();
    } else {
      Object.assign(task, dto);
      if (dto.assignedToId) task.assignedTo = { id: dto.assignedToId } as any;
      // recalculate finalPrice if price changed
      task.finalPrice = Number(task.price) + Number(task.extraFees || 0);
    }
    return this.tasksRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    await this.tasksRepository.delete(id);
  }

  async getLivreurStats(userId: string): Promise<any> {
    const tasks = await this.tasksRepository.find({ where: { assignedTo: { id: userId } } });
    const completed = tasks.filter((t) => t.status === TaskStatus.TERMINEE);
    const totalEarned = completed.reduce((sum, t) => sum + Number(t.finalPrice || t.price), 0);
    return {
      total: tasks.length,
      completed: completed.length,
      pending: tasks.filter((t) => t.status === TaskStatus.EN_ATTENTE).length,
      totalEarned,
    };
  }

  // MOD 6: livreur starts delivery
  async startDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task> {
    const task = await this.findOne(id, user);
    if (task.startedDeliveryAt) {
      throw new BadRequestException('La livraison est déjà démarrée');
    }
    task.startedDeliveryAt = new Date();
    return this.tasksRepository.save(task);
  }

  // MOD 6: livreur finishes delivery
  async finishDelivery(id: string, user: { id: string; role: UserRole }): Promise<Task> {
    const task = await this.findOne(id, user);
    if (!task.startedDeliveryAt) {
      throw new BadRequestException('La livraison n\'a pas encore été démarrée');
    }
    task.finishedDeliveryAt = new Date();
    const diffMs = task.finishedDeliveryAt.getTime() - task.startedDeliveryAt.getTime();
    task.deliveryDurationMinutes = Math.round(diffMs / 60000);
    task.status = TaskStatus.TERMINEE;
    task.completedAt = new Date();
    return this.tasksRepository.save(task);
  }

  // MOD 6: admin adds extra fees
  async addExtraFees(id: string, dto: { extraFees: number; extraFeesNote?: string }): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tâche non trouvée');
    task.extraFees = dto.extraFees;
    task.extraFeesNote = dto.extraFeesNote || null;
    task.finalPrice = Number(task.price) + Number(dto.extraFees);
    return this.tasksRepository.save(task);
  }

  // MOD 8a: get all tasks for a specific livreur (admin only) for printing
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
