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
exports.Company = void 0;
const typeorm_1 = require("typeorm");
let Company = class Company {
};
exports.Company = Company;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Company.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Mon Entreprise' }),
    __metadata("design:type", String)
], Company.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "nif", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "nis", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "rc", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "ai", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "rib", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "bank", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Company.prototype, "logo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Company.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Company.prototype, "signature", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Company.prototype, "stamp", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Company.prototype, "legalMentions", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Company.prototype, "updatedAt", void 0);
exports.Company = Company = __decorate([
    (0, typeorm_1.Entity)('company')
], Company);
//# sourceMappingURL=company.entity.js.map