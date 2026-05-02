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
            .addSelect("SUM(CASE WHEN inv.paymentStatus = 'paid' THEN inv.total ELSE 0 END)", 'paidRevenue')
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
            .select('SUM(task.finalPrice)', 'totalEarnings')
            .where('task.status = :status', { status: task_entity_1.TaskStatus.TERMINEE })
            .getRawOne();
        return {
            total, completed, pending, notCompleted,
            completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
            totalEarnings: Number(earningsResult?.totalEarnings || 0),
        };
    }
    async getUnpaidByClient() {
        return this.invoicesRepo
            .createQueryBuilder('inv')
            .select('inv.clientName', 'clientName')
            .addSelect('inv.clientId', 'clientId')
            .addSelect('inv.clientEmail', 'clientEmail')
            .addSelect('inv.clientPhone', 'clientPhone')
            .addSelect('inv.clientLogoUrl', 'clientLogoUrl')
            .addSelect('SUM(inv.total)', 'unpaidTotal')
            .addSelect('COUNT(*)', 'unpaidCount')
            .addSelect('MIN(inv.createdAt)', 'oldestInvoice')
            .where('inv.paymentStatus = :s', { s: invoice_entity_1.PaymentStatus.UNPAID })
            .andWhere('inv.status != :c', { c: invoice_entity_1.InvoiceStatus.ANNULEE })
            .andWhere('inv.type = :type', { type: invoice_entity_1.InvoiceType.FACTURE })
            .groupBy('inv.clientName')
            .addGroupBy('inv.clientId')
            .addGroupBy('inv.clientEmail')
            .addGroupBy('inv.clientPhone')
            .addGroupBy('inv.clientLogoUrl')
            .orderBy('SUM(inv.total)', 'DESC')
            .getRawMany();
    }
    async getMonthlyRevenue() {
        const rows = await this.invoicesRepo
            .createQueryBuilder('inv')
            .select("TO_CHAR(inv.createdAt, 'YYYY-MM')", 'month')
            .addSelect('SUM(inv.total)', 'revenue')
            .addSelect("SUM(CASE WHEN inv.paymentStatus = 'paid' THEN inv.total ELSE 0 END)", 'paidRevenue')
            .where('inv.type = :type', { type: 'facture' })
            .andWhere("inv.createdAt >= NOW() - INTERVAL '12 months'")
            .groupBy("TO_CHAR(inv.createdAt, 'YYYY-MM')")
            .orderBy("TO_CHAR(inv.createdAt, 'YYYY-MM')", 'ASC')
            .getRawMany();
        return rows;
    }
    async getRevenueByUser() {
        return this.invoicesRepo
            .createQueryBuilder('inv')
            .leftJoin('inv.createdBy', 'user')
            .select('user.name', 'userName')
            .addSelect('user.role', 'userRole')
            .addSelect('COUNT(*)', 'invoiceCount')
            .addSelect('SUM(inv.total)', 'totalRevenue')
            .addSelect("SUM(CASE WHEN inv.paymentStatus = 'paid' THEN inv.total ELSE 0 END)", 'paidRevenue')
            .where('inv.type = :type', { type: 'facture' })
            .groupBy('user.name')
            .addGroupBy('user.role')
            .orderBy('SUM(inv.total)', 'DESC')
            .getRawMany();
    }
    async getTopProducts() {
        const invoices = await this.invoicesRepo
            .createQueryBuilder('inv')
            .select('inv.items', 'items')
            .where('inv.type = :type', { type: 'facture' })
            .getRawMany();
        const productMap = {};
        for (const row of invoices) {
            const items = Array.isArray(row.items) ? row.items : [];
            for (const item of items) {
                const key = item.description;
                if (!productMap[key])
                    productMap[key] = { name: key, qty: 0, revenue: 0 };
                productMap[key].qty += Number(item.quantity);
                productMap[key].revenue += Number(item.total);
            }
        }
        return Object.values(productMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }
    async getOverdueInvoices() {
        return this.invoicesRepo
            .createQueryBuilder('inv')
            .leftJoinAndSelect('inv.createdBy', 'createdBy')
            .where('inv.paymentStatus = :status', { status: invoice_entity_1.PaymentStatus.UNPAID })
            .andWhere('inv.status != :cancelled', { cancelled: invoice_entity_1.InvoiceStatus.ANNULEE })
            .andWhere('inv.type = :type', { type: 'facture' })
            .andWhere("inv.createdAt < NOW() - INTERVAL '30 days'")
            .orderBy('inv.createdAt', 'ASC')
            .getMany();
    }
    async getMarginStats() {
        const result = await this.invoicesRepo
            .createQueryBuilder('inv')
            .select('SUM(inv.totalMargin)', 'totalMargin')
            .addSelect('SUM(inv.total)', 'totalRevenue')
            .where('inv.type = :type', { type: 'facture' })
            .andWhere('inv.status != :cancelled', { cancelled: invoice_entity_1.InvoiceStatus.ANNULEE })
            .getRawOne();
        const totalMargin = Number(result?.totalMargin || 0);
        const totalRevenue = Number(result?.totalRevenue || 0);
        const marginRate = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : '0';
        return { totalMargin, totalRevenue, marginRate };
    }
    async getDeliveryPerformance() {
        const total = await this.tasksRepo.count();
        const completed = await this.tasksRepo.count({ where: { status: task_entity_1.TaskStatus.TERMINEE } });
        const onTime = await this.tasksRepo
            .createQueryBuilder('task')
            .where('task.status = :status', { status: task_entity_1.TaskStatus.TERMINEE })
            .andWhere('task.completedAt <= task.dueDate OR task.dueDate IS NULL')
            .getCount();
        return {
            total,
            completed,
            onTime,
            late: completed - onTime,
            onTimeRate: completed > 0 ? ((onTime / completed) * 100).toFixed(1) : '0',
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
    (0, common_1.Get)('unpaid-by-client'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getUnpaidByClient", null);
__decorate([
    (0, common_1.Get)('monthly-revenue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getMonthlyRevenue", null);
__decorate([
    (0, common_1.Get)('revenue-by-user'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getRevenueByUser", null);
__decorate([
    (0, common_1.Get)('top-products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getTopProducts", null);
__decorate([
    (0, common_1.Get)('overdue-invoices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getOverdueInvoices", null);
__decorate([
    (0, common_1.Get)('margin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getMarginStats", null);
__decorate([
    (0, common_1.Get)('delivery-performance'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getDeliveryPerformance", null);
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