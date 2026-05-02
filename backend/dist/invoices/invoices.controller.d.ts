import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { DeliveryStatus } from './invoice.entity';
export declare class InvoicesController {
    private readonly invoicesService;
    constructor(invoicesService: InvoicesService);
    create(dto: CreateInvoiceDto, req: any): Promise<import("./invoice.entity").Invoice>;
    findAll(req: any, client?: string, date?: string, status?: string, paymentStatus?: string, type?: string, number?: string): Promise<import("./invoice.entity").Invoice[]>;
    getStats(): Promise<any>;
    findOne(id: string, req: any): Promise<import("./invoice.entity").Invoice>;
    update(id: string, dto: UpdateInvoiceDto, req: any): Promise<import("./invoice.entity").Invoice>;
    updateDelivery(id: string, status: DeliveryStatus): Promise<import("./invoice.entity").Invoice>;
    updatePayment(id: string, paymentStatus: string): Promise<import("./invoice.entity").Invoice>;
    updateWorkflow(id: string, step: string): Promise<import("./invoice.entity").Invoice>;
    remove(id: string): Promise<void>;
}
