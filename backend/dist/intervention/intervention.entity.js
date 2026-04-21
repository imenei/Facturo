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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Intervention = exports.InterventionType = exports.WorkType = exports.InterventionStatus = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
var InterventionStatus;
(function (InterventionStatus) {
    InterventionStatus["EN_ATTENTE"] = "en_attente";
    InterventionStatus["EN_COURS"] = "en_cours";
    InterventionStatus["EN_PAUSE"] = "en_pause";
    InterventionStatus["TERMINEE"] = "terminee";
    InterventionStatus["NON_REPAREE"] = "non_reparee";
})(InterventionStatus || (exports.InterventionStatus = InterventionStatus = {}));
var WorkType;
(function (WorkType) {
    WorkType["ELECTRONIQUE"] = "electronique";
    WorkType["INFORMATIQUE"] = "informatique";
    WorkType["RESEAU"] = "reseau";
    WorkType["ELECTRIQUE"] = "electrique";
    WorkType["MECANIQUE"] = "mecanique";
    WorkType["AUTRE"] = "autre";
})(WorkType || (exports.WorkType = WorkType = {}));
var InterventionType;
(function (InterventionType) {
    InterventionType["REPARATION"] = "reparation";
    InterventionType["MAINTENANCE"] = "maintenance";
    InterventionType["INSTALLATION"] = "installation";
    InterventionType["DIAGNOSTIC"] = "diagnostic";
    InterventionType["SAV"] = "sav";
})(InterventionType || (exports.InterventionType = InterventionType = {}));
let Intervention = class Intervention {
};
exports.Intervention = Intervention;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Intervention.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], Intervention.prototype, "ticketNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: InterventionStatus, default: InterventionStatus.EN_ATTENTE }),
    __metadata("design:type", String)
], Intervention.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: WorkType, default: WorkType.INFORMATIQUE }),
    __metadata("design:type", String)
], Intervention.prototype, "workType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: InterventionType, default: InterventionType.REPARATION }),
    __metadata("design:type", String)
], Intervention.prototype, "interventionType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Intervention.prototype, "clientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Intervention.prototype, "clientPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Intervention.prototype, "clientEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Intervention.prototype, "clientAddress", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Intervention.prototype, "machineName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Intervention.prototype, "machineBrand", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Intervention.prototype, "machineModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Intervention.prototype, "serialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", Date)
], Intervention.prototype, "entryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'date' }),
    __metadata("design:type", Date)
], Intervention.prototype, "expectedExitDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'date' }),
    __metadata("design:type", Date)
], Intervention.prototype, "actualExitDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Intervention.prototype, "clientDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Intervention.prototype, "technicalDiagnosis", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Intervention.prototype, "actionsPerformed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Intervention.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Intervention.prototype, "estimatedMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Intervention.prototype, "workedMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamptz' }),
    __metadata("design:type", Date)
], Intervention.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamptz' }),
    __metadata("design:type", Date)
], Intervention.prototype, "finishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], Intervention.prototype, "materialsUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], Intervention.prototype, "photos", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Intervention.prototype, "clientSignature", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], Intervention.prototype, "signedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Intervention.prototype, "laborCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Intervention.prototype, "partsCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Intervention.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, nullable: true }),
    __metadata("design:type", user_entity_1.User)
], Intervention.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, nullable: true }),
    __metadata("design:type", user_entity_1.User)
], Intervention.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Intervention.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Intervention.prototype, "updatedAt", void 0);
exports.Intervention = Intervention = __decorate([
    (0, typeorm_1.Entity)('interventions')
], Intervention);
//# sourceMappingURL=intervention.entity.js.map