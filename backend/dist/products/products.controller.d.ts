import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './product.dto';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(dto: CreateProductDto): Promise<import("./product.entity").Product>;
    findAll(search?: string): Promise<import("./product.entity").Product[]>;
    findOne(id: string): Promise<import("./product.entity").Product>;
    getMargin(id: string): Promise<any>;
    update(id: string, dto: UpdateProductDto): Promise<import("./product.entity").Product>;
    remove(id: string): Promise<void>;
}
