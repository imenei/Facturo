import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Invoice } from '../invoices/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
