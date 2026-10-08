import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_settings')
export class NotificationSetting {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
