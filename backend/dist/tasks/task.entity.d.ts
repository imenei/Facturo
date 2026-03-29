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
    completedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
