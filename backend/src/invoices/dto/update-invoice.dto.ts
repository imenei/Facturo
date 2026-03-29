import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, InvoiceType } from '../invoice.entity';

class InvoiceItemDto {
  @IsString()
  description: string;
  @IsNumber()
  quantity: number;
  @IsNumber()
  unitPrice: number;
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional()
  @IsBoolean()
  hasTva?: boolean;

  @IsOptional()
  @IsNumber()
  tvaRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  dueDate?: Date;
}
