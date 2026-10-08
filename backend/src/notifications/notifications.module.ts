import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Invoice } from '../invoices/invoice.entity';
import { ReminderHistory } from './reminder-history.entity';
import { NotificationSetting } from './notification-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, ReminderHistory, NotificationSetting])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
