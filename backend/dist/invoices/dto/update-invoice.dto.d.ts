import { InvoiceStatus, InvoiceType } from '../invoice.entity';
declare class InvoiceItemDto {
    description: string;
    quantity: number;
    unitPrice: number;
}
export declare class UpdateInvoiceDto {
    type?: InvoiceType;
    status?: InvoiceStatus;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    clientNif?: string;
    clientNis?: string;
    items?: InvoiceItemDto[];
    hasTva?: boolean;
    tvaRate?: number;
    notes?: string;
    dueDate?: Date;
}
export {};
