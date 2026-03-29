import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
      ...dto,
      createdBy: { id: adminId },
      assignedTo: { id: dto.assignedToId },
    });
    
return this.tasksRepository.save(task) as unknown as Promise<Task>;
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
    // Livreur can only update status and remarks
    if (user.role === UserRole.LIVREUR) {
      if (dto.status) task.status = dto.status;
      if (dto.remarks !== undefined) task.remarks = dto.remarks;
      if (dto.status === TaskStatus.TERMINEE) task.completedAt = new Date();
    } else {
      Object.assign(task, dto);
      if (dto.assignedToId) task.assignedTo = { id: dto.assignedToId } as any;
    }
    return this.tasksRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    await this.tasksRepository.delete(id);
  }

  async getLivreurStats(userId: string): Promise<any> {
    const tasks = await this.tasksRepository.find({ where: { assignedTo: { id: userId } } });
    const completed = tasks.filter((t) => t.status === TaskStatus.TERMINEE);
    const totalEarned = completed.reduce((sum, t) => sum + Number(t.price), 0);
    return { total: tasks.length, completed: completed.length, pending: tasks.filter(t => t.status === TaskStatus.EN_ATTENTE).length, totalEarned };
  }
}
