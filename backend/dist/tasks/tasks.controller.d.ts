import { TasksService } from './tasks.service';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    create(dto: any, req: any): Promise<import("./task.entity").Task>;
    findAll(req: any): Promise<import("./task.entity").Task[]>;
    getMyStats(req: any): Promise<any>;
    getByLivreur(livreurId: string, from?: string, to?: string): Promise<import("./task.entity").Task[]>;
    findOne(id: string, req: any): Promise<import("./task.entity").Task>;
    update(id: string, dto: any, req: any): Promise<import("./task.entity").Task>;
    startDelivery(id: string, req: any): Promise<import("./task.entity").Task>;
    finishDelivery(id: string, req: any): Promise<import("./task.entity").Task>;
    addExtraFees(id: string, body: {
        extraFees: number;
        extraFeesNote?: string;
    }): Promise<import("./task.entity").Task>;
    remove(id: string): Promise<void>;
}
