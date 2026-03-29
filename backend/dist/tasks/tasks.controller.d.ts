import { TasksService } from './tasks.service';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    create(dto: any, req: any): Promise<import("./task.entity").Task>;
    findAll(req: any): Promise<import("./task.entity").Task[]>;
    getMyStats(req: any): Promise<any>;
    findOne(id: string, req: any): Promise<import("./task.entity").Task>;
    update(id: string, dto: any, req: any): Promise<import("./task.entity").Task>;
    remove(id: string): Promise<void>;
}
