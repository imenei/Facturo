import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller';
import { Invoice } from '../invoices/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice])],
  controllers: [ClientsController],
})
export class ClientsModule {}
