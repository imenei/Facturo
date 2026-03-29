"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const users_service_1 = require("./users/users.service");
const user_entity_1 = require("./users/user.entity");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const usersService = app.get(users_service_1.UsersService);
    try {
        await usersService.create({
            email: 'admin@facturo.dz',
            password: 'Admin@1234',
            name: 'Administrateur',
            role: user_entity_1.UserRole.ADMIN,
        });
        console.log('✅ Admin créé: admin@facturo.dz / Admin@1234');
    }
    catch (e) {
        console.log('ℹ️  Admin existe déjà ou erreur:', e.message);
    }
    try {
        await usersService.create({
            email: 'commercial@facturo.dz',
            password: 'Commercial@1234',
            name: 'Commercial Demo',
            role: user_entity_1.UserRole.COMMERCIAL,
        });
        console.log('✅ Commercial créé: commercial@facturo.dz / Commercial@1234');
    }
    catch (e) {
        console.log('ℹ️  Commercial existe déjà');
    }
    try {
        await usersService.create({
            email: 'livreur@facturo.dz',
            password: 'Livreur@1234',
            name: 'Livreur Demo',
            phone: '+213 550 000 000',
            role: user_entity_1.UserRole.LIVREUR,
        });
        console.log('✅ Livreur créé: livreur@facturo.dz / Livreur@1234');
    }
    catch (e) {
        console.log('ℹ️  Livreur existe déjà');
    }
    await app.close();
    console.log('\n🚀 Base de données initialisée avec succès!');
}
bootstrap();
//# sourceMappingURL=seed.js.map