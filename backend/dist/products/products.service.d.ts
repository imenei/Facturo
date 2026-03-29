import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './product.dto';
export declare class ProductsService {
    private productsRepo;
    constructor(productsRepo: Repository<Product>);
    create(dto: CreateProductDto): Promise<Product>;
    findAll(search?: string): Promise<Product[]>;
    findOne(id: string): Promise<Product>;
    update(id: string, dto: UpdateProductDto): Promise<Product>;
    remove(id: string): Promise<void>;
    getMargin(id: string): Promise<any>;
}
