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
const platform_express_1 = require("@nestjs/platform-express");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const multer_1 = require("multer");
const path_1 = require("path");
const uuid_1 = require("uuid");
const invoice_entity_1 = require("../invoices/invoice.entity");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const logoStorage = (0, multer_1.diskStorage)({
    destination: './uploads/logos',
    filename: (req, file, cb) => cb(null, `client-${(0, uuid_1.v4)()}${(0, path_1.extname)(file.originalname)}`),
});
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
            .addSelect('MAX(inv.clientLogoUrl)', 'clientLogoUrl')
            .addSelect('COUNT(*)', 'documentCount')
            .addSelect('SUM(inv.total)', 'totalAmount')
            .addSelect("SUM(CASE WHEN inv.paymentStatus = 'unpaid' AND inv.status != 'annulee' AND inv.type = 'facture' THEN inv.total ELSE 0 END)", 'unpaidAmount')
            .addSelect("COUNT(CASE WHEN inv.paymentStatus = 'unpaid' AND inv.status != 'annulee' AND inv.type = 'facture' THEN 1 END)", 'unpaidCount')
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
    async getClientDetails(clientId, type, paymentStatus) {
        const qb = this.invoicesRepo
            .createQueryBuilder('inv')
            .leftJoinAndSelect('inv.createdBy', 'createdBy')
            .leftJoinAndSelect('inv.lastModifiedBy', 'lastModifiedBy')
            .where('inv.clientId = :clientId', { clientId })
            .orderBy('inv.createdAt', 'DESC');
        if (type)
            qb.andWhere('inv.type = :type', { type });
        if (paymentStatus)
            qb.andWhere('inv.paymentStatus = :paymentStatus', { paymentStatus });
        const docs = await qb.getMany();
        if (docs.length === 0) {
            return {
                clientId,
                clientName: '',
                clientEmail: '',
                clientPhone: '',
                clientAddress: '',
                clientLogoUrl: null,
                summary: { totalDocuments: 0, totalRevenue: 0, totalPaid: 0, totalUnpaid: 0, facturesCount: 0, proformasCount: 0, bonsCount: 0, averageInvoice: 0, firstOrder: null, lastOrder: null },
                factures: [],
                proformas: [],
                bonsLivraison: [],
                products: [],
                monthlyRevenue: [],
            };
        }
        const factures = docs.filter((d) => d.type === 'facture');
        const proformas = docs.filter((d) => d.type === 'proforma');
        const bons = docs.filter((d) => d.type === 'bon_livraison');
        const totalPaid = factures.filter((f) => f.paymentStatus === 'paid').reduce((s, f) => s + Number(f.total), 0);
        const totalUnpaid = factures.filter((f) => f.paymentStatus === 'unpaid').reduce((s, f) => s + Number(f.total), 0);
        const totalRevenue = factures.reduce((s, f) => s + Number(f.total), 0);
        const productMap = {};
        for (const inv of factures) {
            const items = Array.isArray(inv.items) ? inv.items : [];
            for (const item of items) {
                const key = item.description;
                if (!productMap[key]) {
                    productMap[key] = { name: key, qty: 0, revenue: 0, lastDate: inv.createdAt };
                }
                productMap[key].qty += Number(item.quantity);
                productMap[key].revenue += Number(item.total);
                if (new Date(inv.createdAt) > new Date(productMap[key].lastDate)) {
                    productMap[key].lastDate = inv.createdAt;
                }
            }
        }
        const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
        const monthlyMap = {};
        for (const inv of factures) {
            const month = new Date(inv.createdAt).toISOString().slice(0, 7);
            monthlyMap[month] = (monthlyMap[month] || 0) + Number(inv.total);
        }
        const monthlyRevenue = Object.entries(monthlyMap)
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => a.month.localeCompare(b.month));
        const clientLogoUrl = docs.find((d) => d.clientLogoUrl)?.['clientLogoUrl'] ?? null;
        const dates = factures.map((f) => new Date(f.createdAt));
        return {
            clientId,
            clientName: docs[0]?.clientName || '',
            clientEmail: docs[0]?.clientEmail || '',
            clientPhone: docs[0]?.clientPhone || '',
            clientAddress: docs[0]?.clientAddress || '',
            clientLogoUrl,
            summary: {
                totalDocuments: docs.length,
                totalRevenue,
                totalPaid,
                totalUnpaid,
                facturesCount: factures.length,
                proformasCount: proformas.length,
                bonsCount: bons.length,
                averageInvoice: factures.length > 0 ? totalRevenue / factures.length : 0,
                firstOrder: dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
                lastOrder: dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
            },
            factures,
            proformas,
            bonsLivraison: bons,
            products,
            monthlyRevenue,
        };
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
        const totalPaid = factures.filter((f) => f.paymentStatus === 'paid').reduce((sum, f) => sum + Number(f.total), 0);
        const totalUnpaid = factures.filter((f) => f.paymentStatus === 'unpaid').reduce((sum, f) => sum + Number(f.total), 0);
        const clientLogoUrl = docs.find((d) => !!d.clientLogoUrl)?.['clientLogoUrl'] ?? null;
        return {
            clientId,
            clientName: docs[0]?.clientName || '',
            clientEmail: docs[0]?.clientEmail || '',
            clientPhone: docs[0]?.clientPhone || '',
            clientAddress: docs[0]?.clientAddress || '',
            clientLogoUrl,
            summary: { totalDocuments: docs.length, totalPaid, totalUnpaid, facturesCount: factures.length, proformasCount: proformas.length, bonsCount: bons.length },
            factures,
            proformas,
            bonsLivraison: bons,
        };
    }
    async uploadLogo(clientId, file) {
        if (!file)
            throw new common_1.BadRequestException('Aucun fichier reçu');
        const logoUrl = `/uploads/logos/${file.filename}`;
        await this.invoicesRepo.createQueryBuilder()
            .update(invoice_entity_1.Invoice)
            .set({ clientLogoUrl: logoUrl })
            .where('clientId = :clientId', { clientId })
            .execute();
        return { success: true, clientLogoUrl: logoUrl };
    }
    async removeLogo(clientId) {
        await this.invoicesRepo.createQueryBuilder()
            .update(invoice_entity_1.Invoice)
            .set({ clientLogoUrl: null })
            .where('clientId = :clientId', { clientId })
            .execute();
        return { success: true };
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
    (0, common_1.Get)(':id/details'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('paymentStatus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getClientDetails", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getClientDocuments", null);
__decorate([
    (0, common_1.Patch)(':id/logo'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: logoStorage,
        fileFilter: (req, file, cb) => {
            const ok = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
            if (!ok.includes((0, path_1.extname)(file.originalname).toLowerCase())) {
                return cb(new common_1.BadRequestException('Format non supporté'), false);
            }
            cb(null, true);
        },
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "uploadLogo", null);
__decorate([
    (0, common_1.Patch)(':id/logo-remove'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "removeLogo", null);
exports.ClientsController = ClientsController = __decorate([
    (0, common_1.Controller)('clients'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ClientsController);
//# sourceMappingURL=clients.controller.js.map