import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterventionsService } from './intervention.service';
import { InterventionsController } from './intervention.controller';
import { Intervention } from './intervention.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Intervention])],
  providers: [InterventionsService],
  controllers: [InterventionsController],
  exports: [InterventionsService],
})
export class InterventionsModule {}