import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InvoiceStatus, InvoiceType } from '../invoice.entity';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : value;

class InvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  purchasePrice?: number;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  clientAddress?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  clientNif?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  clientNis?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional()
  @IsBoolean()
  hasTva?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tvaRate?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
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
}
