"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../invoices/invoice.entity");
const task_entity_1 = require("../tasks/task.entity");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const user_entity_1 = require("../users/user.entity");
let StatsController = class StatsController {
    constructor(invoicesRepo, tasksRepo) {
        this.invoicesRepo = invoicesRepo;
        this.tasksRepo = tasksRepo;
    }
    async getTotalRevenue() {
        const result = await this.invoicesRepo
            .createQueryBuilder('inv')
            .select('SUM(inv.total)', 'total')
            .addSelect('COUNT(*)', 'count')
            .where('inv.paymentStatus = :status', { status: invoice_entity_1.PaymentStatus.PAID })
            .andWhere('inv.type = :type', { type: 'facture' })
            .getRawOne();
        const unpaid = await this.invoicesRepo
            .createQueryBuilder('inv')
            .select('SUM(inv.total)', 'total')
            .where('inv.paymentStatus = :status', { status: invoice_entity_1.PaymentStatus.UNPAID })
            .andWhere('inv.type = :type', { type: 'facture' })
            .andWhere('inv.status != :cancelled', { cancelled: invoice_entity_1.InvoiceStatus.ANNULEE })
            .getRawOne();
        return {
            totalRevenue: Number(result?.total || 0),
            paidInvoicesCount: Number(result?.count || 0),
            unpaidRevenue: Number(unpaid?.total || 0),
        };
    }
    async getRevenueByClient() {
        return this.invoicesRepo
            .createQueryBuilder('inv')
            .select('inv.clientName', 'clientName')
            .addSelect('inv.clientId', 'clientId')
            .addSelect('SUM(inv.total)', 'totalRevenue')
            .addSelect('COUNT(*)', 'invoiceCount')
            .addSelect('SUM(CASE WHEN inv.paymentStatus = \'paid\' THEN inv.total ELSE 0 END)', 'paidRevenue')
            .where('inv.type = :type', { type: 'facture' })
            .groupBy('inv.clientName')
            .addGroupBy('inv.clientId')
            .orderBy('SUM(inv.total)', 'DESC')
            .getRawMany();
    }
    async getInvoicesCount() {
        const [total, paid, unpaid, cancelled, draft] = await Promise.all([
            this.invoicesRepo.count({ where: { type: 'facture' } }),
            this.invoicesRepo.count({ where: { type: 'facture', paymentStatus: invoice_entity_1.PaymentStatus.PAID } }),
            this.invoicesRepo.count({ where: { type: 'facture', paymentStatus: invoice_entity_1.PaymentStatus.UNPAID, status: invoice_entity_1.InvoiceStatus.EMISE } }),
            this.invoicesRepo.count({ where: { type: 'facture', status: invoice_entity_1.InvoiceStatus.ANNULEE } }),
            this.invoicesRepo.count({ where: { type: 'facture', status: invoice_entity_1.InvoiceStatus.BROUILLON } }),
        ]);
        return { total, paid, unpaid, cancelled, draft };
    }
    async getDeliveriesCompleted() {
        const [total, completed, pending, notCompleted] = await Promise.all([
            this.tasksRepo.count(),
            this.tasksRepo.count({ where: { status: task_entity_1.TaskStatus.TERMINEE } }),
            this.tasksRepo.count({ where: { status: task_entity_1.TaskStatus.EN_ATTENTE } }),
            this.tasksRepo.count({ where: { status: task_entity_1.TaskStatus.NON_TERMINEE } }),
        ]);
        const earningsResult = await this.tasksRepo
            .createQueryBuilder('task')
            .select('SUM(task.price)', 'totalEarnings')
            .where('task.status = :status', { status: task_entity_1.TaskStatus.TERMINEE })
            .getRawOne();
        return {
            total,
            completed,
            pending,
            notCompleted,
            completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
            totalEarnings: Number(earningsResult?.totalEarnings || 0),
        };
    }
    async getOverview() {
        const [revenue, invoicesCount, deliveries] = await Promise.all([
            this.getTotalRevenue(),
            this.getInvoicesCount(),
            this.getDeliveriesCompleted(),
        ]);
        return { revenue, invoicesCount, deliveries };
    }
};
exports.StatsController = StatsController;
__decorate([
    (0, common_1.Get)('revenue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getTotalRevenue", null);
__decorate([
    (0, common_1.Get)('revenue-by-client'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getRevenueByClient", null);
__decorate([
    (0, common_1.Get)('invoices-count'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getInvoicesCount", null);
__decorate([
    (0, common_1.Get)('deliveries-completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getDeliveriesCompleted", null);
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getOverview", null);
exports.StatsController = StatsController = __decorate([
    (0, common_1.Controller)('stats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __param(1, (0, typeorm_1.InjectRepository)(task_entity_1.Task)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], StatsController);
//# sourceMappingURL=stats.controller.js.map