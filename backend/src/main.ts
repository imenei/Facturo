import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads', 'logos');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // Serve static uploads
  (app as any).useStaticAssets?.(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Facturo API running on port ${port}`);
  console.log(`📁 Uploads served at /uploads/`);
}
bootstrap();

