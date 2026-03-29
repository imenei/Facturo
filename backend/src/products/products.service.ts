import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepo: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    if (dto.salePrice <= dto.purchasePrice) {
      throw new BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
    }
    const product = this.productsRepo.create(dto);
    return this.productsRepo.save(product);
  }

  async findAll(search?: string): Promise<Product[]> {
    if (search) {
      return this.productsRepo.find({
        where: [{ name: Like(`%${search}%`) }, { reference: Like(`%${search}%`) }],
        order: { name: 'ASC' },
      });
    }
    return this.productsRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Product> {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Produit non trouvé');
    return p;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    const newSale = dto.salePrice ?? product.salePrice;
    const newPurchase = dto.purchasePrice ?? product.purchasePrice;
    if (newSale <= newPurchase) {
      throw new BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
    }
    Object.assign(product, dto);
    return this.productsRepo.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.isActive = false;
    await this.productsRepo.save(product);
  }

  async getMargin(id: string): Promise<any> {
    const p = await this.findOne(id);
    const margin = Number(p.salePrice) - Number(p.purchasePrice);
    const marginPct = (margin / Number(p.purchasePrice)) * 100;
    return { purchasePrice: p.purchasePrice, salePrice: p.salePrice, margin, marginPct: marginPct.toFixed(2) };
  }
}
