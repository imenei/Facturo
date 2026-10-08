import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InvoiceAdjustmentType, InvoiceType } from '../invoice.entity';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : value;

class InvoiceItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  purchasePrice?: number;
}

class InvoiceChargeDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceType)
  type!: InvoiceType; // ✅

  @IsString()
  clientName!: string; // ✅

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientAddress?: string;

  @IsOptional()
  @IsString()
  clientNif?: string;

  @IsOptional()
  @IsString()
  clientNis?: string;

  @IsOptional()
  @IsString()
  clientLogoUrl?: string; // ✅ fix ts2339

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  sourceInvoiceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[]; // ✅

  @IsBoolean()
  hasTva!: boolean; // ✅

  @IsOptional()
  @IsNumber()
  tvaRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  templateType?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  issuerName?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  issuerNameSize?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discountPercent?: number;

  @IsOptional()
  @IsEnum(InvoiceAdjustmentType)
  adjustmentType?: InvoiceAdjustmentType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  adjustmentPercent?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  otherCharge?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceChargeDto)
  otherCharges?: InvoiceChargeDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  deliveryPrice?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  deliveryPersonId?: string;
}