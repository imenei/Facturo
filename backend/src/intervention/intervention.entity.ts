// backend/src/interventions/intervention.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum InterventionStatus {
  EN_ATTENTE   = 'en_attente',
  EN_COURS     = 'en_cours',
  EN_PAUSE     = 'en_pause',
  TERMINEE     = 'terminee',
  NON_REPAREE  = 'non_reparee',
}

export enum WorkType {
  ELECTRONIQUE = 'electronique',
  INFORMATIQUE = 'informatique',
  RESEAU       = 'reseau',
  ELECTRIQUE   = 'electrique',
  MECANIQUE    = 'mecanique',
  AUTRE        = 'autre',
}

export enum InterventionType {
  REPARATION    = 'reparation',
  MAINTENANCE   = 'maintenance',
  INSTALLATION  = 'installation',
  DIAGNOSTIC    = 'diagnostic',
  SAV           = 'sav',
}

@Entity('interventions')
export class Intervention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketNumber: string;

  @Column({ type: 'enum', enum: InterventionStatus, default: InterventionStatus.EN_ATTENTE })
  status: InterventionStatus;

  @Column({ type: 'enum', enum: WorkType, default: WorkType.INFORMATIQUE })
  workType: WorkType;

  @Column({ type: 'enum', enum: InterventionType, default: InterventionType.REPARATION })
  interventionType: InterventionType;

  // ── Client ────────────────────────────────────────────────────────────────
  @Column()
  clientName: string;

  @Column({ nullable: true })
  clientPhone: string;

  @Column({ nullable: true })
  clientEmail: string;

  @Column({ nullable: true })
  clientAddress: string;

  // ── Machine ───────────────────────────────────────────────────────────────
  @Column()
  machineName: string;

  @Column({ nullable: true })
  machineBrand: string;

  @Column({ nullable: true })
  machineModel: string;

  @Column({ nullable: true })
  serialNumber: string;

  // ── Dates ─────────────────────────────────────────────────────────────────
  @Column({ type: 'date' })
  entryDate: Date;

  @Column({ nullable: true, type: 'date' })
  expectedExitDate: Date;

  @Column({ nullable: true, type: 'date' })
  actualExitDate: Date;

  // ── Description ───────────────────────────────────────────────────────────
  @Column({ nullable: true, type: 'text' })
  clientDescription: string;

  // ── Technical report (filled by technicien) ───────────────────────────────
  @Column({ nullable: true, type: 'text' })
  technicalDiagnosis: string;

  @Column({ nullable: true, type: 'text' })
  actionsPerformed: string;   // actions réalisées pendant l'intervention

  @Column({ nullable: true, type: 'text' })
  remarks: string;

  // ── Time tracking (minutes) ───────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  estimatedMinutes: number;   // durée estimée (admin)

  @Column({ type: 'int', default: 0 })
  workedMinutes: number;      // durée réelle (technicien via chrono)

  @Column({ nullable: true, type: 'timestamptz' })
  startedAt: Date;            // quand le technicien démarre

  @Column({ nullable: true, type: 'timestamptz' })
  finishedAt: Date;           // quand il termine

  // ── Materials ─────────────────────────────────────────────────────────────
  @Column({ type: 'jsonb', default: '[]' })
  materialsUsed: MaterialItem[];

  // ── Photos (base64 or URLs) ───────────────────────────────────────────────
  @Column({ type: 'jsonb', default: '[]' })
  photos: string[];           // array of base64 or /uploads/... paths

  // ── Client signature ──────────────────────────────────────────────────────
  @Column({ nullable: true, type: 'text' })
  clientSignature: string;    // base64 PNG of signature

  @Column({ nullable: true })
  signedAt: Date;

  // ── Pricing ───────────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  laborCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  partsCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPrice: number;

  // ── Relations ─────────────────────────────────────────────────────────────
  @ManyToOne(() => User, { eager: true, nullable: true })
  assignedTo: User;

  @ManyToOne(() => User, { eager: true, nullable: true })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface MaterialItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}