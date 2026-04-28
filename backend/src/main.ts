import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads', 'logos');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // Allow larger JSON/form payloads for logos and rich template/company settings.
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

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

