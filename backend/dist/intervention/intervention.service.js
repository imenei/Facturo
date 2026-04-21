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
exports.InterventionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const intervention_entity_1 = require("./intervention.entity");
const user_entity_1 = require("../users/user.entity");
let InterventionsService = class InterventionsService {
    constructor(repo) {
        this.repo = repo;
    }
    async generateTicket() {
        const year = new Date().getFullYear();
        const count = await this.repo.count();
        return `INT-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    calcTotals(dto, existing) {
        const materials = dto.materialsUsed ?? existing?.materialsUsed ?? [];
        const partsCost = materials.reduce((s, m) => s + Number(m.quantity) * Number(m.unitPrice), 0);
        const totalPrice = Number(dto.laborCost ?? existing?.laborCost ?? 0) + partsCost;
        return { partsCost, totalPrice };
    }
    mapMaterials(raw) {
        return (raw || []).map(m => ({
            name: m.name,
            quantity: Number(m.quantity),
            unitPrice: Number(m.unitPrice),
            total: Number(m.quantity) * Number(m.unitPrice),
        }));
    }
    isTech(user) {
        return user.role === user_entity_1.UserRole.TECHNICIEN || user.role === 'technicien';
    }
    assertAccess(item, user) {
        if (this.isTech(user) && item.assignedTo?.id !== user.id) {
            throw new common_1.ForbiddenException('Accès refusé');
        }
    }
    async create(dto, createdById) {
        const ticketNumber = await this.generateTicket();
        const materials = this.mapMaterials(dto.materialsUsed || []);
        const { partsCost, totalPrice } = this.calcTotals({ ...dto, materialsUsed: materials });
        const item = this.repo.create({
            ...dto,
            ticketNumber,
            materialsUsed: materials,
            photos: dto.photos || [],
            partsCost,
            totalPrice,
            createdBy: { id: createdById },
            assignedTo: dto.assignedToId ? { id: dto.assignedToId } : null,
        });
        return this.repo.save(item);
    }
    async findAll(user, filters) {
        const qb = this.repo.createQueryBuilder('i')
            .leftJoinAndSelect('i.assignedTo', 'assignedTo')
            .leftJoinAndSelect('i.createdBy', 'createdBy')
            .orderBy('i.createdAt', 'DESC');
        if (this.isTech(user)) {
            qb.where('assignedTo.id = :uid', { uid: user.id });
        }
        if (filters?.status)
            qb.andWhere('i.status = :s', { s: filters.status });
        if (filters?.workType)
            qb.andWhere('i.workType = :wt', { wt: filters.workType });
        if (filters?.clientName)
            qb.andWhere('LOWER(i.clientName) LIKE :cn', { cn: `%${filters.clientName.toLowerCase()}%` });
        if (filters?.serialNumber)
            qb.andWhere('LOWER(i.serialNumber) LIKE :sn', { sn: `%${filters.serialNumber.toLowerCase()}%` });
        if (filters?.dateFrom)
            qb.andWhere('i.entryDate >= :df', { df: filters.dateFrom });
        if (filters?.dateTo)
            qb.andWhere('i.entryDate <= :dt', { dt: filters.dateTo });
        return qb.getMany();
    }
    async findOne(id, user) {
        const item = await this.repo.findOne({ where: { id }, relations: ['assignedTo', 'createdBy'] });
        if (!item)
            throw new common_1.NotFoundException('Intervention non trouvée');
        this.assertAccess(item, user);
        return item;
    }
    async update(id, dto, user) {
        const item = await this.findOne(id, user);
        this.assertAccess(item, user);
        if (this.isTech(user)) {
            const allowed = [
                'status', 'technicalDiagnosis', 'actionsPerformed', 'remarks',
                'materialsUsed', 'laborCost', 'actualExitDate', 'interventionType',
                'photos', 'workedMinutes',
            ];
            for (const key of allowed) {
                if (dto[key] !== undefined)
                    item[key] = dto[key];
            }
            if (dto.materialsUsed)
                item.materialsUsed = this.mapMaterials(dto.materialsUsed);
        }
        else {
            const materials = dto.materialsUsed ? this.mapMaterials(dto.materialsUsed) : item.materialsUsed;
            Object.assign(item, dto, { materialsUsed: materials });
            if (dto.assignedToId)
                item.assignedTo = { id: dto.assignedToId };
        }
        const { partsCost, totalPrice } = this.calcTotals(item, item);
        item.partsCost = partsCost;
        item.totalPrice = totalPrice;
        return this.repo.save(item);
    }
    async startIntervention(id, user) {
        const item = await this.findOne(id, user);
        this.assertAccess(item, user);
        if (item.status === intervention_entity_1.InterventionStatus.TERMINEE) {
            throw new common_1.BadRequestException('Intervention déjà terminée');
        }
        item.status = intervention_entity_1.InterventionStatus.EN_COURS;
        item.startedAt = new Date();
        return this.repo.save(item);
    }
    async pauseIntervention(id, user, workedMinutes) {
        const item = await this.findOne(id, user);
        this.assertAccess(item, user);
        item.status = intervention_entity_1.InterventionStatus.EN_PAUSE;
        item.workedMinutes += workedMinutes;
        return this.repo.save(item);
    }
    async finishIntervention(id, user, payload) {
        const item = await this.findOne(id, user);
        this.assertAccess(item, user);
        item.status = intervention_entity_1.InterventionStatus.TERMINEE;
        item.finishedAt = new Date();
        item.actualExitDate = new Date();
        if (payload.technicalDiagnosis !== undefined)
            item.technicalDiagnosis = payload.technicalDiagnosis;
        if (payload.actionsPerformed !== undefined)
            item.actionsPerformed = payload.actionsPerformed;
        if (payload.remarks !== undefined)
            item.remarks = payload.remarks;
        if (payload.workedMinutes !== undefined)
            item.workedMinutes = (item.workedMinutes || 0) + payload.workedMinutes;
        if (payload.photos !== undefined)
            item.photos = payload.photos;
        if (payload.laborCost !== undefined)
            item.laborCost = payload.laborCost;
        if (payload.clientSignature) {
            item.clientSignature = payload.clientSignature;
            item.signedAt = new Date();
        }
        if (payload.materialsUsed) {
            item.materialsUsed = this.mapMaterials(payload.materialsUsed);
        }
        const { partsCost, totalPrice } = this.calcTotals(item, item);
        item.partsCost = partsCost;
        item.totalPrice = totalPrice;
        return this.repo.save(item);
    }
    async addPhoto(id, user, photoBase64) {
        const item = await this.findOne(id, user);
        this.assertAccess(item, user);
        item.photos = [...(item.photos || []), photoBase64];
        return this.repo.save(item);
    }
    async saveSignature(id, user, signature) {
        const item = await this.findOne(id, user);
        this.assertAccess(item, user);
        item.clientSignature = signature;
        item.signedAt = new Date();
        return this.repo.save(item);
    }
    async getMachineHistory(serialNumber) {
        return this.repo.find({
            where: { serialNumber: (0, typeorm_2.ILike)(`%${serialNumber}%`) },
            order: { createdAt: 'DESC' },
            relations: ['assignedTo'],
        });
    }
    async getClientHistory(clientName) {
        return this.repo.find({
            where: { clientName: (0, typeorm_2.ILike)(`%${clientName}%`) },
            order: { createdAt: 'DESC' },
            relations: ['assignedTo'],
        });
    }
    async getTechStats(userId) {
        const all = await this.repo.find({
            where: { assignedTo: { id: userId } },
            relations: ['assignedTo'],
        });
        const done = all.filter(i => i.status === intervention_entity_1.InterventionStatus.TERMINEE);
        const inProgress = all.filter(i => i.status === intervention_entity_1.InterventionStatus.EN_COURS);
        const totalWorkedMin = done.reduce((s, i) => s + (i.workedMinutes || 0), 0);
        return {
            total: all.length,
            done: done.length,
            inProgress: inProgress.length,
            pending: all.filter(i => i.status === intervention_entity_1.InterventionStatus.EN_ATTENTE).length,
            totalEarned: done.reduce((s, i) => s + Number(i.totalPrice), 0),
            totalWorkedHours: Math.round((totalWorkedMin / 60) * 10) / 10,
        };
    }
    async getAdminStats() {
        const [total, done, inProgress, pending, paused] = await Promise.all([
            this.repo.count(),
            this.repo.count({ where: { status: intervention_entity_1.InterventionStatus.TERMINEE } }),
            this.repo.count({ where: { status: intervention_entity_1.InterventionStatus.EN_COURS } }),
            this.repo.count({ where: { status: intervention_entity_1.InterventionStatus.EN_ATTENTE } }),
            this.repo.count({ where: { status: intervention_entity_1.InterventionStatus.EN_PAUSE } }),
        ]);
        const rev = await this.repo.createQueryBuilder('i')
            .select('SUM(i.totalPrice)', 'total')
            .where('i.status = :s', { s: intervention_entity_1.InterventionStatus.TERMINEE })
            .getRawOne();
        return { total, done, inProgress, pending, paused, totalRevenue: Number(rev?.total || 0) };
    }
    async remove(id) {
        await this.repo.delete(id);
    }
};
exports.InterventionsService = InterventionsService;
exports.InterventionsService = InterventionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(intervention_entity_1.Intervention)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], InterventionsService);
//# sourceMappingURL=intervention.service.js.map