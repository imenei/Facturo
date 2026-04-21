"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const intervention_module_1 = require("./intervention/intervention.module");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const invoices_module_1 = require("./invoices/invoices.module");
const deliveries_module_1 = require("./deliveries/deliveries.module");
const tasks_module_1 = require("./tasks/tasks.module");
const company_module_1 = require("./company/company.module");
const products_module_1 = require("./products/products.module");
const stats_module_1 = require("./stats/stats.module");
const notifications_module_1 = require("./notifications/notifications.module");
const clients_module_1 = require("./clients/clients.module");
const templates_module_1 = require("./templates/templates.module");
const upload_module_1 = require("./upload/upload.module");
const gateway_module_1 = require("./gateway/gateway.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                username: process.env.DB_USER || 'facturo',
                password: process.env.DB_PASS || 'facturo_pass',
                database: process.env.DB_NAME || 'facturo_db',
                autoLoadEntities: true,
                synchronize: process.env.NODE_ENV !== 'production',
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            invoices_module_1.InvoicesModule,
            deliveries_module_1.DeliveriesModule,
            tasks_module_1.TasksModule,
            company_module_1.CompanyModule,
            products_module_1.ProductsModule,
            stats_module_1.StatsModule,
            notifications_module_1.NotificationsModule,
            clients_module_1.ClientsModule,
            templates_module_1.TemplatesModule,
            upload_module_1.UploadModule,
            gateway_module_1.GatewayModule,
            intervention_module_1.InterventionsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map