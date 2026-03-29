import { IsString, IsNumber, IsOptional, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'salePriceHigher', async: false })
export class SalePriceHigherThanPurchase implements ValidatorConstraintInterface {
  validate(salePrice: number, args: ValidationArguments) {
    const obj = args.object as any;
    return salePrice > obj.purchasePrice;
  }
  defaultMessage() {
    return 'Le prix de vente doit être supérieur au prix d\'achat';
  }
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsNumber()
  @Min(0)
  @Validate(SalePriceHigherThanPurchase)
  salePrice: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;
}
