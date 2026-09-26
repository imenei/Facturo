import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum DeletionRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('invoice_deletion_requests')
export class InvoiceDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoiceId: string;

  @Column()
  invoiceNumber: string;

  @Column({ nullable: true })
  clientName: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: DeletionRequestStatus.PENDING })
  status: DeletionRequestStatus;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User;

  @Column({ nullable: true, type: 'timestamp' })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
