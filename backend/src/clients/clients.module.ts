import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ClientsController } from './clients.controller';
import { Invoice } from '../invoices/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    MulterModule.register({ dest: './uploads' }),
  ],
  controllers: [ClientsController],
})
export class ClientsModule {}