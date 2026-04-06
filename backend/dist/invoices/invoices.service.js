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
exports.InvoicesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("./invoice.entity");
const user_entity_1 = require("../users/user.entity");
let InvoicesService = class InvoicesService {
    constructor(invoicesRepository) {
        this.invoicesRepository = invoicesRepository;
    }
    async generateNumber(type) {
        const prefix = type === invoice_entity_1.InvoiceType.FACTURE ? 'FAC' : type === invoice_entity_1.InvoiceType.PROFORMA ? 'PRO' : 'BL';
        const year = new Date().getFullYear();
        const count = await this.invoicesRepository.count({ where: { type } });
        return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    async create(dto, userId) {
        const number = await this.generateNumber(dto.type);
        const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const tvaAmount = dto.hasTva ? (subtotal * (dto.tvaRate || 19)) / 100 : 0;
        const total = subtotal + tvaAmount;
        const items = dto.items.map((item, i) => ({
            id: String(i + 1),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
        }));
        const clientId = this.buildClientId(dto.clientName, dto.clientPhone);
        const invoice = this.invoicesRepository.create({
            ...dto,
            number,
            items,
            subtotal,
            tvaAmount,
            total,
            clientId,
            clientLogoUrl: dto.clientLogoUrl ?? undefined,
            paymentStatus: invoice_entity_1.PaymentStatus.UNPAID,
            createdBy: { id: userId },
        });
        return this.invoicesRepository.save(invoice);
    }
    async findAll(user, filters) {
        const qb = this.invoicesRepository
            .createQueryBuilder('inv')
            .leftJoinAndSelect('inv.createdBy', 'createdBy')
            .orderBy('inv.createdAt', 'DESC');
        if (user.role !== user_entity_1.UserRole.ADMIN) {
            qb.where('createdBy.id = :userId', { userId: user.id });
        }
        if (filters?.client) {
            qb.andWhere('LOWER(inv.clientName) LIKE :client', { client: `%${filters.client.toLowerCase()}%` });
        }
        if (filters?.date) {
            qb.andWhere('DATE(inv.createdAt) = :date', { date: filters.date });
        }
        if (filters?.status) {
            qb.andWhere('inv.status = :status', { status: filters.status });
        }
        if (filters?.paymentStatus) {
            qb.andWhere('inv.paymentStatus = :paymentStatus', { paymentStatus: filters.paymentStatus });
        }
        if (filters?.type) {
            qb.andWhere('inv.type = :type', { type: filters.type });
        }
        return qb.getMany();
    }
    buildClientId(name, phone) {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        return phone ? `${slug}-${phone.replace(/\D/g, '').slice(-6)}` : slug;
    }
    async findOne(id, user) {
        const invoice = await this.invoicesRepository.findOne({ where: { id }, relations: ['createdBy'] });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
        if (user.role !== user_entity_1.UserRole.ADMIN && invoice.createdBy.id !== user.id) {
            throw new common_1.ForbiddenException('Accès refusé');
        }
        return invoice;
    }
    async update(id, dto, user) {
        const invoice = await this.findOne(id, user);
        if (dto.items) {
            const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            const tvaAmount = dto.hasTva ? (subtotal * (dto.tvaRate || 19)) / 100 : 0;
            const total = subtotal + tvaAmount;
            Object.assign(invoice, { subtotal, tvaAmount, total });
        }
        Object.assign(invoice, dto);
        return this.invoicesRepository.save(invoice);
    }
    async updateDeliveryStatus(id, status) {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
        invoice.deliveryStatus = status;
        return this.invoicesRepository.save(invoice);
    }
    async updatePaymentStatus(id, paymentStatus) {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
        invoice.paymentStatus = paymentStatus;
        if (paymentStatus === invoice_entity_1.PaymentStatus.PAID) {
            invoice.status = invoice_entity_1.InvoiceStatus.PAYEE;
            invoice.workflowStep = invoice_entity_1.WorkflowStep.RECOUVREMENT;
        }
        return this.invoicesRepository.save(invoice);
    }
    async updateWorkflowStep(id, step) {
        const invoice = await this.invoicesRepository.findOne({ where: { id } });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
        invoice.workflowStep = step;
        return this.invoicesRepository.save(invoice);
    }
    async remove(id) {
        await this.invoicesRepository.delete(id);
    }
    async getStats() {
        const total = await this.invoicesRepository.count();
        const paid = await this.invoicesRepository.count({ where: { status: invoice_entity_1.InvoiceStatus.PAYEE } });
        const pending = await this.invoicesRepository.count({ where: { status: invoice_entity_1.InvoiceStatus.EMISE } });
        const result = await this.invoicesRepository
            .createQueryBuilder('inv')
            .select('SUM(inv.total)', 'totalRevenue')
            .where('inv.status = :status', { status: invoice_entity_1.InvoiceStatus.PAYEE })
            .getRawOne();
        return { total, paid, pending, totalRevenue: result?.totalRevenue || 0 };
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map