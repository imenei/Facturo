import { User } from '../users/user.entity';
export declare enum InvoiceType {
    FACTURE = "facture",
    PROFORMA = "proforma",
    BON_LIVRAISON = "bon_livraison"
}
export declare enum InvoiceStatus {
    BROUILLON = "brouillon",
    EMISE = "emise",
    PAYEE = "payee",
    ANNULEE = "annulee"
}
export declare enum PaymentStatus {
    UNPAID = "unpaid",
    PAID = "paid"
}
export declare enum DeliveryStatus {
    EN_ATTENTE = "en_attente",
    LIVREE = "livree",
    NON_LIVREE = "non_livree"
}
export declare enum WorkflowStep {
    COMMANDE = "commande",
    LIVRAISON = "livraison",
    FACTURATION = "facturation",
    RECOUVREMENT = "recouvrement"
}
export declare class Invoice {
    id: string;
    number: string;
    type: InvoiceType;
    status: InvoiceStatus;
    deliveryStatus: DeliveryStatus;
    paymentStatus: PaymentStatus;
    workflowStep: WorkflowStep;
    clientId: string;
    deliveryDate: Date;
    templateType: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    clientNif: string;
    clientNis: string;
    items: InvoiceItem[];
    subtotal: number;
    hasTva: boolean;
    tvaRate: number;
    tvaAmount: number;
    total: number;
    notes: string;
    dueDate: Date;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}
export interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}
