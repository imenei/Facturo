import { Repository } from 'typeorm';
import { Invoice, DeliveryStatus, PaymentStatus, WorkflowStep } from './invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UserRole } from '../users/user.entity';
export declare class InvoicesService {
    private invoicesRepository;
    constructor(invoicesRepository: Repository<Invoice>);
    private generateNumber;
    private buildClientId;
    create(dto: CreateInvoiceDto, userId: string): Promise<Invoice>;
    findAll(user: {
        id: string;
        role: UserRole;
    }, filters?: {
        client?: string;
        date?: string;
        status?: string;
        type?: string;
        paymentStatus?: string;
    }): Promise<Invoice[]>;
    findOne(id: string, user: {
        id: string;
        role: UserRole;
    }): Promise<Invoice>;
    update(id: string, dto: UpdateInvoiceDto, user: {
        id: string;
        role: UserRole;
    }): Promise<Invoice>;
    updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<Invoice>;
    updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Invoice>;
    updateWorkflowStep(id: string, step: WorkflowStep): Promise<Invoice>;
    remove(id: string): Promise<void>;
    getStats(): Promise<any>;
}
