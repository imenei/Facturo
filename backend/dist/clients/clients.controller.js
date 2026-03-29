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
exports.ClientsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../invoices/invoice.entity");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let ClientsController = class ClientsController {
    constructor(invoicesRepo) {
        this.invoicesRepo = invoicesRepo;
    }
    async getClients(name) {
        const qb = this.invoicesRepo
            .createQueryBuilder('inv')
            .select('inv.clientName', 'clientName')
            .addSelect('inv.clientId', 'clientId')
            .addSelect('inv.clientEmail', 'clientEmail')
            .addSelect('inv.clientPhone', 'clientPhone')
            .addSelect('inv.clientAddress', 'clientAddress')
            .addSelect('COUNT(*)', 'documentCount')
            .addSelect('SUM(inv.total)', 'totalAmount')
            .groupBy('inv.clientName')
            .addGroupBy('inv.clientId')
            .addGroupBy('inv.clientEmail')
            .addGroupBy('inv.clientPhone')
            .addGroupBy('inv.clientAddress')
            .orderBy('inv.clientName', 'ASC');
        if (name) {
            qb.where('LOWER(inv.clientName) LIKE :name', { name: `%${name.toLowerCase()}%` });
        }
        return qb.getRawMany();
    }
    async getClientDocuments(clientId, type, status) {
        const qb = this.invoicesRepo
            .createQueryBuilder('inv')
            .leftJoinAndSelect('inv.createdBy', 'createdBy')
            .where('inv.clientId = :clientId', { clientId })
            .orderBy('inv.createdAt', 'DESC');
        if (type)
            qb.andWhere('inv.type = :type', { type });
        if (status)
            qb.andWhere('inv.paymentStatus = :status', { status });
        const docs = await qb.getMany();
        const factures = docs.filter((d) => d.type === 'facture');
        const proformas = docs.filter((d) => d.type === 'proforma');
        const bons = docs.filter((d) => d.type === 'bon_livraison');
        const totalPaid = factures
            .filter((f) => f.paymentStatus === 'paid')
            .reduce((sum, f) => sum + Number(f.total), 0);
        const totalUnpaid = factures
            .filter((f) => f.paymentStatus === 'unpaid')
            .reduce((sum, f) => sum + Number(f.total), 0);
        return {
            clientId,
            clientName: docs[0]?.clientName || '',
            clientEmail: docs[0]?.clientEmail || '',
            clientPhone: docs[0]?.clientPhone || '',
            clientAddress: docs[0]?.clientAddress || '',
            summary: {
                totalDocuments: docs.length,
                totalPaid,
                totalUnpaid,
                facturesCount: factures.length,
                proformasCount: proformas.length,
                bonsCount: bons.length,
            },
            factures,
            proformas,
            bonsLivraison: bons,
        };
    }
};
exports.ClientsController = ClientsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getClients", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getClientDocuments", null);
exports.ClientsController = ClientsController = __decorate([
    (0, common_1.Controller)('clients'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ClientsController);
//# sourceMappingURL=clients.controller.js.map