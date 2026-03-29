import { ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
export declare class SalePriceHigherThanPurchase implements ValidatorConstraintInterface {
    validate(salePrice: number, args: ValidationArguments): boolean;
    defaultMessage(): string;
}
export declare class CreateProductDto {
    name: string;
    description?: string;
    reference?: string;
    unit?: string;
    purchasePrice: number;
    salePrice: number;
}
export declare class UpdateProductDto {
    name?: string;
    description?: string;
    reference?: string;
    unit?: string;
    purchasePrice?: number;
    salePrice?: number;
}
