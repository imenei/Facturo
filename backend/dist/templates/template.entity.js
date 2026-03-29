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
exports.DocumentTemplate = exports.TemplateType = void 0;
const typeorm_1 = require("typeorm");
var TemplateType;
(function (TemplateType) {
    TemplateType["CLASSIC"] = "classic";
    TemplateType["COMPACT"] = "compact";
    TemplateType["DETAILED"] = "detailed";
    TemplateType["CORPORATE"] = "corporate";
    TemplateType["TABLE_FOCUS"] = "table_focus";
})(TemplateType || (exports.TemplateType = TemplateType = {}));
let DocumentTemplate = class DocumentTemplate {
};
exports.DocumentTemplate = DocumentTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: TemplateType }),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], DocumentTemplate.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DocumentTemplate.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "headerText", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "footerText", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'left' }),
    __metadata("design:type", String)
], DocumentTemplate.prototype, "logoPosition", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DocumentTemplate.prototype, "showSignature", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DocumentTemplate.prototype, "showStamp", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DocumentTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DocumentTemplate.prototype, "updatedAt", void 0);
exports.DocumentTemplate = DocumentTemplate = __decorate([
    (0, typeorm_1.Entity)('document_templates')
], DocumentTemplate);
//# sourceMappingURL=template.entity.js.map