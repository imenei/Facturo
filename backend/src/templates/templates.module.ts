import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { DocumentTemplate } from './template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentTemplate])],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
