// Ajouter dans backend/src/app.module.ts :

// 1. Import en haut du fichier :
import { InterventionsModule } from './intervention/intervention.module';

// 2. Ajouter dans le tableau imports[] :
// InterventionsModule,

// Exemple complet :
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { TasksModule } from './tasks/tasks.module';
import { CompanyModule } from './company/company.module';
import { ProductsModule } from './products/products.module';
import { StatsModule } from './stats/stats.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ClientsModule } from './clients/clients.module';
import { TemplatesModule } from './templates/templates.module';
import { UploadModule } from './upload/upload.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'facturo',
      password: process.env.DB_PASS || 'facturo_pass',
      database: process.env.DB_NAME || 'facturo_db',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    UsersModule,
    InvoicesModule,
    DeliveriesModule,
    TasksModule,
    CompanyModule,
    ProductsModule,
    StatsModule,
    NotificationsModule,
    ClientsModule,
    TemplatesModule,
    UploadModule,
    GatewayModule,
    InterventionsModule, // ← NOUVEAU
  ],
})
export class AppModule {}