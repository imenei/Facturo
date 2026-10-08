import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reminder_history')
@Index(['invoiceId', 'createdAt'])
export class ReminderHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @Column()
  invoiceNumber: string;

  @Column()
  recipientEmail: string;

  @Column({ default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
