import { User } from '../users/user.entity';
export declare enum InterventionStatus {
    EN_ATTENTE = "en_attente",
    EN_COURS = "en_cours",
    EN_PAUSE = "en_pause",
    TERMINEE = "terminee",
    NON_REPAREE = "non_reparee"
}
export declare enum WorkType {
    ELECTRONIQUE = "electronique",
    INFORMATIQUE = "informatique",
    RESEAU = "reseau",
    ELECTRIQUE = "electrique",
    MECANIQUE = "mecanique",
    AUTRE = "autre"
}
export declare enum InterventionType {
    REPARATION = "reparation",
    MAINTENANCE = "maintenance",
    INSTALLATION = "installation",
    DIAGNOSTIC = "diagnostic",
    SAV = "sav"
}
export declare class Intervention {
    id: string;
    ticketNumber: string;
    status: InterventionStatus;
    workType: WorkType;
    interventionType: InterventionType;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    clientAddress: string;
    machineName: string;
    machineBrand: string;
    machineModel: string;
    serialNumber: string;
    entryDate: Date;
    expectedExitDate: Date;
    actualExitDate: Date;
    clientDescription: string;
    technicalDiagnosis: string;
    actionsPerformed: string;
    remarks: string;
    estimatedMinutes: number;
    workedMinutes: number;
    startedAt: Date;
    finishedAt: Date;
    materialsUsed: MaterialItem[];
    photos: string[];
    clientSignature: string;
    signedAt: Date;
    laborCost: number;
    partsCost: number;
    totalPrice: number;
    assignedTo: User;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}
export interface MaterialItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
}
