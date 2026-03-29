import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { Task } from '../tasks/task.entity';

export enum UserRole {
  ADMIN = 'admin',
  COMMERCIAL = 'commercial',
  LIVREUR = 'livreur',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.COMMERCIAL })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Invoice, (invoice) => invoice.createdBy)
  invoices: Invoice[];

  @OneToMany(() => Task, (task) => task.assignedTo)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
