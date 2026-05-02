import { User } from '../users/user.entity';
export declare enum TaskStatus {
    EN_ATTENTE = "en_attente",
    TERMINEE = "terminee",
    NON_TERMINEE = "non_terminee"
}
export declare class Task {
    id: string;
    name: string;
    description: string;
    price: number;
    status: TaskStatus;
    remarks: string;
    assignedTo: User;
    createdBy: User;
    dueDate: Date;
    deliveryDate: Date;
    clientName: string;
    clientLogoUrl: string;
    clientAddress: string;
    completedAt: Date;
    startedDeliveryAt: Date;
    finishedDeliveryAt: Date;
    deliveryDurationMinutes: number;
    extraFees: number;
    extraFeesNote: string;
    finalPrice: number;
    createdAt: Date;
    updatedAt: Date;
}
