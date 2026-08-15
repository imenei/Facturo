import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterventionsService } from './intervention.service';
import { InterventionsController } from './intervention.controller';
import { Intervention } from './intervention.entity';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([Intervention]), GatewayModule],
  providers: [InterventionsService],
  controllers: [InterventionsController],
  exports: [InterventionsService],
})
export class InterventionsModule {}