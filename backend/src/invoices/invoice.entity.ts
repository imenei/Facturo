import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

export enum InvoiceType {
  FACTURE = 'facture',
  PROFORMA = 'proforma',
  BON_LIVRAISON = 'bon_livraison',
}

export enum InvoiceStatus {
  BROUILLON = 'brouillon',
  EMISE = 'emise',
  PAYEE = 'payee',
  ANNULEE = 'annulee',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
}

export enum DeliveryStatus {
  EN_ATTENTE = 'en_attente',
  LIVREE = 'livree',
  NON_LIVREE = 'non_livree',
}

// Workflow: commande → livraison → facturation → recouvrement
export enum WorkflowStep {
  COMMANDE = 'commande',
  LIVRAISON = 'livraison',
  FACTURATION = 'facturation',
  RECOUVREMENT = 'recouvrement',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  number: string;

  @Column({ type: 'enum', enum: InvoiceType, default: InvoiceType.FACTURE })
  type: InvoiceType;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.BROUILLON })
  status: InvoiceStatus;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.EN_ATTENTE })
  deliveryStatus: DeliveryStatus;

  // Payment status (modification 2)
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  // Workflow step (modification 2)
  @Column({ type: 'enum', enum: WorkflowStep, default: WorkflowStep.COMMANDE })
  workflowStep: WorkflowStep;

  // Client identifier for grouping (modification 3)
  @Column({ nullable: true })
  clientId: string; // normalized slug from clientName+phone

  // Delivery date (modification 7 — nullable)
  @Column({ nullable: true, type: 'date' })
  deliveryDate: Date;

  // Template used (modification 12)
  @Column({ nullable: true })
  templateType: string;

  // Client info
  @Column()
  clientName: string;

  @Column({ nullable: true })
  clientEmail: string;

  @Column({ nullable: true })
  clientPhone: string;

  @Column({ nullable: true })
  clientAddress: string;

  @Column({ nullable: true })
  clientNif: string;

  @Column({ nullable: true })
  clientNis: string;

  // Items JSON
  @Column({ type: 'jsonb', default: '[]' })
  items: InvoiceItem[];

  // Amounts
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal: number;

  @Column({ default: false })
  hasTva: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19 })
  tvaRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tvaAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total: number;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  dueDate: Date;

  @ManyToOne(() => User, (user) => user.invoices, { eager: true })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
