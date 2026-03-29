import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { Task } from '../tasks/task.entity';
export declare class StatsController {
    private invoicesRepo;
    private tasksRepo;
    constructor(invoicesRepo: Repository<Invoice>, tasksRepo: Repository<Task>);
    getTotalRevenue(): Promise<{
        totalRevenue: number;
        paidInvoicesCount: number;
        unpaidRevenue: number;
    }>;
    getRevenueByClient(): Promise<any[]>;
    getInvoicesCount(): Promise<{
        total: number;
        paid: number;
        unpaid: number;
        cancelled: number;
        draft: number;
    }>;
    getDeliveriesCompleted(): Promise<{
        total: number;
        completed: number;
        pending: number;
        notCompleted: number;
        completionRate: string;
        totalEarnings: number;
    }>;
    getOverview(): Promise<{
        revenue: {
            totalRevenue: number;
            paidInvoicesCount: number;
            unpaidRevenue: number;
        };
        invoicesCount: {
            total: number;
            paid: number;
            unpaid: number;
            cancelled: number;
            draft: number;
        };
        deliveries: {
            total: number;
            completed: number;
            pending: number;
            notCompleted: number;
            completionRate: string;
            totalEarnings: number;
        };
    }>;
}
