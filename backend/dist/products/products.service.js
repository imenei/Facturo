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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("./product.entity");
let ProductsService = class ProductsService {
    constructor(productsRepo) {
        this.productsRepo = productsRepo;
    }
    async create(dto) {
        if (dto.salePrice <= dto.purchasePrice) {
            throw new common_1.BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
        }
        const product = this.productsRepo.create(dto);
        return this.productsRepo.save(product);
    }
    async findAll(search) {
        if (search) {
            return this.productsRepo.find({
                where: [{ name: (0, typeorm_2.Like)(`%${search}%`) }, { reference: (0, typeorm_2.Like)(`%${search}%`) }],
                order: { name: 'ASC' },
            });
        }
        return this.productsRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    }
    async findOne(id) {
        const p = await this.productsRepo.findOne({ where: { id } });
        if (!p)
            throw new common_1.NotFoundException('Produit non trouvé');
        return p;
    }
    async update(id, dto) {
        const product = await this.findOne(id);
        const newSale = dto.salePrice ?? product.salePrice;
        const newPurchase = dto.purchasePrice ?? product.purchasePrice;
        if (newSale <= newPurchase) {
            throw new common_1.BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
        }
        Object.assign(product, dto);
        return this.productsRepo.save(product);
    }
    async remove(id) {
        const product = await this.findOne(id);
        product.isActive = false;
        await this.productsRepo.save(product);
    }
    async getMargin(id) {
        const p = await this.findOne(id);
        const margin = Number(p.salePrice) - Number(p.purchasePrice);
        const marginPct = (margin / Number(p.purchasePrice)) * 100;
        return { purchasePrice: p.purchasePrice, salePrice: p.salePrice, margin, marginPct: marginPct.toFixed(2) };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProductsService);
//# sourceMappingURL=products.service.js.map