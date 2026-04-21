import { Repository } from 'typeorm';
import { Intervention } from './intervention.entity';
import { UserRole } from '../users/user.entity';
interface RequestUser {
    id: string;
    role: UserRole | string;
}
export declare class InterventionsService {
    private repo;
    constructor(repo: Repository<Intervention>);
    private generateTicket;
    private calcTotals;
    private mapMaterials;
    private isTech;
    private assertAccess;
    create(dto: any, createdById: string): Promise<Intervention>;
    findAll(user: RequestUser, filters?: {
        status?: string;
        workType?: string;
        clientName?: string;
        serialNumber?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<Intervention[]>;
    findOne(id: string, user: RequestUser): Promise<Intervention>;
    update(id: string, dto: any, user: RequestUser): Promise<Intervention>;
    startIntervention(id: string, user: RequestUser): Promise<Intervention>;
    pauseIntervention(id: string, user: RequestUser, workedMinutes: number): Promise<Intervention>;
    finishIntervention(id: string, user: RequestUser, payload: {
        technicalDiagnosis?: string;
        actionsPerformed?: string;
        remarks?: string;
        materialsUsed?: any[];
        laborCost?: number;
        workedMinutes?: number;
        photos?: string[];
        clientSignature?: string;
    }): Promise<Intervention>;
    addPhoto(id: string, user: RequestUser, photoBase64: string): Promise<Intervention>;
    saveSignature(id: string, user: RequestUser, signature: string): Promise<Intervention>;
    getMachineHistory(serialNumber: string): Promise<Intervention[]>;
    getClientHistory(clientName: string): Promise<Intervention[]>;
    getTechStats(userId: string): Promise<{
        total: number;
        done: number;
        inProgress: number;
        pending: number;
        totalEarned: number;
        totalWorkedHours: number;
    }>;
    getAdminStats(): Promise<{
        total: number;
        done: number;
        inProgress: number;
        pending: number;
        paused: number;
        totalRevenue: number;
    }>;
    remove(id: string): Promise<void>;
}
export {};
