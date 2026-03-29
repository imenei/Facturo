import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { UserRole } from '../users/user.entity';
export declare class TasksService {
    private tasksRepository;
    constructor(tasksRepository: Repository<Task>);
    create(dto: any, adminId: string): Promise<Task>;
    findAll(user: {
        id: string;
        role: UserRole;
    }): Promise<Task[]>;
    findOne(id: string, user: {
        id: string;
        role: UserRole;
    }): Promise<Task>;
    update(id: string, dto: any, user: {
        id: string;
        role: UserRole;
    }): Promise<Task>;
    remove(id: string): Promise<void>;
    getLivreurStats(userId: string): Promise<any>;
}
