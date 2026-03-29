/**
 * Seed script — creates the default admin user
 * Run: npx ts-node src/seed.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { UserRole } from './users/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    await usersService.create({
      email: 'admin@facturo.dz',
      password: 'Admin@1234',
      name: 'Administrateur',
      role: UserRole.ADMIN,
    });
    console.log('✅ Admin créé: admin@facturo.dz / Admin@1234');
  } catch (e) {
    console.log('ℹ️  Admin existe déjà ou erreur:', e.message);
  }

  try {
    await usersService.create({
      email: 'commercial@facturo.dz',
      password: 'Commercial@1234',
      name: 'Commercial Demo',
      role: UserRole.COMMERCIAL,
    });
    console.log('✅ Commercial créé: commercial@facturo.dz / Commercial@1234');
  } catch (e) {
    console.log('ℹ️  Commercial existe déjà');
  }

  try {
    await usersService.create({
      email: 'livreur@facturo.dz',
      password: 'Livreur@1234',
      name: 'Livreur Demo',
      phone: '+213 550 000 000',
      role: UserRole.LIVREUR,
    });
    console.log('✅ Livreur créé: livreur@facturo.dz / Livreur@1234');
  } catch (e) {
    console.log('ℹ️  Livreur existe déjà');
  }

  await app.close();
  console.log('\n🚀 Base de données initialisée avec succès!');
}

bootstrap();
