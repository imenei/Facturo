import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { mkdirSync } from 'fs';

// Ensure uploads directory exists
try { mkdirSync('./uploads/logos', { recursive: true }); } catch {}

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  controllers: [UploadController],
})
export class UploadModule {}
