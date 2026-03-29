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
exports.TemplatesService = exports.TEMPLATE_TYPES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const template_entity_1 = require("./template.entity");
exports.TEMPLATE_TYPES = [
    {
        type: template_entity_1.TemplateType.CLASSIC,
        name: 'Classic',
        description: 'Mise en page standard, logo en haut à gauche, tableau simple',
        logoPosition: 'left',
    },
    {
        type: template_entity_1.TemplateType.COMPACT,
        name: 'Compact',
        description: 'Informations condensées, gain de place, idéal pour petites factures',
        logoPosition: 'left',
    },
    {
        type: template_entity_1.TemplateType.DETAILED,
        name: 'Detailed',
        description: 'Mise en page détaillée avec sections bien séparées et sous-totaux visibles',
        logoPosition: 'left',
    },
    {
        type: template_entity_1.TemplateType.CORPORATE,
        name: 'Corporate',
        description: 'Logo centré, informations entreprise en évidence, structure formelle',
        logoPosition: 'center',
    },
    {
        type: template_entity_1.TemplateType.TABLE_FOCUS,
        name: 'Table Focus',
        description: 'Accent sur le tableau produits, colonnes larges et lisibles',
        logoPosition: 'right',
    },
];
let TemplatesService = class TemplatesService {
    constructor(templatesRepo) {
        this.templatesRepo = templatesRepo;
    }
    getTypes() {
        return exports.TEMPLATE_TYPES;
    }
    async findAll() {
        return this.templatesRepo.find({ where: { isActive: true }, order: { createdAt: 'ASC' } });
    }
    async findOne(id) {
        const t = await this.templatesRepo.findOne({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Template non trouvé');
        return t;
    }
    async getDefault() {
        return this.templatesRepo.findOne({ where: { isDefault: true, isActive: true } });
    }
    async create(dto) {
        const t = this.templatesRepo.create(dto);
        return this.templatesRepo.save(t);
    }
    async update(id, dto) {
        const t = await this.findOne(id);
        Object.assign(t, dto);
        return this.templatesRepo.save(t);
    }
    async setDefault(id) {
        await this.templatesRepo.update({}, { isDefault: false });
        const t = await this.findOne(id);
        t.isDefault = true;
        return this.templatesRepo.save(t);
    }
    async remove(id) {
        const t = await this.findOne(id);
        t.isActive = false;
        await this.templatesRepo.save(t);
    }
    async seedDefaults() {
        const count = await this.templatesRepo.count();
        if (count > 0)
            return;
        for (const [i, tmpl] of exports.TEMPLATE_TYPES.entries()) {
            await this.templatesRepo.save(this.templatesRepo.create({ ...tmpl, isDefault: i === 0, isActive: true }));
        }
    }
};
exports.TemplatesService = TemplatesService;
exports.TemplatesService = TemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(template_entity_1.DocumentTemplate)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TemplatesService);
//# sourceMappingURL=templates.service.js.map