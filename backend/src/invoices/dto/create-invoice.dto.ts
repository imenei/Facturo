import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceType } from '../invoice.entity';

class InvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @IsString()
  clientName: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsBoolean()
  hasTva: boolean;

  @IsOptional()
  @IsNumber()
  tvaRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  dueDate?: Date;
}
