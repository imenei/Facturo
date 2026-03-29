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

  // Modification 7 — date de livraison optionnelle (nullable)
  @Column({ nullable: true, type: 'date' })
  deliveryDate: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
