import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { Invoice } from '../invoices/invoice.entity';
import { Task } from '../tasks/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Task])],
  controllers: [StatsController],
})
export class StatsModule {}
