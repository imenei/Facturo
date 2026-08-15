import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InvoiceType } from '../invoice.entity';

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
}