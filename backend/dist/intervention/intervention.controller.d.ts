import { InterventionsService } from './intervention.service';
export declare class InterventionsController {
    private readonly svc;
    constructor(svc: InterventionsService);
    create(dto: any, req: any): Promise<import("./intervention.entity").Intervention>;
    findAll(req: any, status?: string, workType?: string, clientName?: string, serialNumber?: string, dateFrom?: string, dateTo?: string): Promise<import("./intervention.entity").Intervention[]>;
    getStats(req: any): Promise<{
        total: number;
        done: number;
        inProgress: number;
        pending: number;
        totalEarned: number;
        totalWorkedHours: number;
    }> | Promise<{
        total: number;
        done: number;
        inProgress: number;
        pending: number;
        paused: number;
        totalRevenue: number;
    }>;
    getMachineHistory(sn: string): Promise<import("./intervention.entity").Intervention[]>;
    getClientHistory(cn: string): Promise<import("./intervention.entity").Intervention[]>;
    findOne(id: string, req: any): Promise<import("./intervention.entity").Intervention>;
    update(id: string, dto: any, req: any): Promise<import("./intervention.entity").Intervention>;
    start(id: string, req: any): Promise<import("./intervention.entity").Intervention>;
    pause(id: string, workedMinutes: number, req: any): Promise<import("./intervention.entity").Intervention>;
    finish(id: string, payload: any, req: any): Promise<import("./intervention.entity").Intervention>;
    addPhoto(id: string, photo: string, req: any): Promise<import("./intervention.entity").Intervention>;
    saveSignature(id: string, signature: string, req: any): Promise<import("./intervention.entity").Intervention>;
    remove(id: string): Promise<void>;
}
