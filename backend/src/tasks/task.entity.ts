import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

export enum TaskStatus {
  EN_ATTENTE = 'en_attente',
  TERMINEE = 'terminee',
  NON_TERMINEE = 'non_terminee',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.EN_ATTENTE })
  status: TaskStatus;

  @Column({ nullable: true, type: 'text' })
  remarks: string;

  @ManyToOne(() => User, (user) => user.tasks, { eager: true })
  assignedTo: User;

  @ManyToOne(() => User, { eager: true, nullable: true })
  createdBy: User;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ nullable: true, type: 'date' })
  deliveryDate: Date;

  @Column({ nullable: true })
  clientName: string;

  @Column({ nullable: true, type: 'text' })
  clientLogoUrl: string;

  @Column({ nullable: true, type: 'text' })
  clientAddress: string;

  @Column({ nullable: true })
  completedAt: Date;

  // MOD 6: delivery tracking by livreur
  @Column({ nullable: true, type: 'timestamp' })
  startedDeliveryAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  finishedDeliveryAt: Date;

  @Column({ nullable: true, type: 'integer' })
  deliveryDurationMinutes: number;

  // MOD 6: extra fees added by admin (unforeseen costs)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, nullable: true })
  extraFees: number;

  @Column({ nullable: true, type: 'text' })
  extraFeesNote: string;

  // MOD 6: final price = price + extraFees
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, nullable: true })
  finalPrice: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
