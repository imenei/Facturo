import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { Invoice } from './invoice.entity';
import { InvoiceDeletionRequest } from './invoice-deletion-request.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceDeletionRequest]), GatewayModule, UsersModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
