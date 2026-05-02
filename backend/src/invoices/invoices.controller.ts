import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Patch, Query } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { DeliveryStatus } from './invoice.entity';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  create(@Body() dto: CreateInvoiceDto, @Request() req) {
    return this.invoicesService.create(dto, req.user.id);
  }

  // MOD 2: added ?number= query param for invoice number search
  @Get()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  findAll(
    @Request() req,
    @Query('client') client?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('type') type?: string,
    @Query('number') number?: string,  // MOD 2
  ) {
    return this.invoicesService.findAll(req.user, { client, date, status, paymentStatus, type, number });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  getStats() {
    return this.invoicesService.getStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  findOne(@Param('id') id: string, @Request() req) {
    return this.invoicesService.findOne(id, req.user);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @Request() req) {
    return this.invoicesService.update(id, dto, req.user);
  }

  @Patch(':id/delivery-status')
  @Roles(UserRole.ADMIN)
  updateDelivery(@Param('id') id: string, @Body('status') status: DeliveryStatus) {
    return this.invoicesService.updateDeliveryStatus(id, status);
  }

  @Patch(':id/payment-status')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  updatePayment(@Param('id') id: string, @Body('paymentStatus') paymentStatus: string) {
    return this.invoicesService.updatePaymentStatus(id, paymentStatus as any);
  }

  @Patch(':id/workflow')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  updateWorkflow(@Param('id') id: string, @Body('step') step: string) {
    return this.invoicesService.updateWorkflowStep(id, step as any);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
