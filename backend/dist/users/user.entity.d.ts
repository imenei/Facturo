import { Invoice } from '../invoices/invoice.entity';
import { Task } from '../tasks/task.entity';
export declare enum UserRole {
    ADMIN = "admin",
    COMMERCIAL = "commercial",
    LIVREUR = "livreur",
    TECHNICIEN = "technicien"
}
export declare class User {
    id: string;
    email: string;
    password: string;
    name: string;
    phone: string;
    specialty: string;
    role: UserRole;
    isActive: boolean;
    invoices: Invoice[];
    tasks: Task[];
    createdAt: Date;
    updatedAt: Date;
}
