// backend/src/interventions/interventions.controller.ts
import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { InterventionsService } from './intervention.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('interventions')
@UseGuards(JwtAuthGuard)
export class InterventionsController {
  constructor(private readonly svc: InterventionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TECHNICIEN)
  create(@Body() dto: any, @Request() req: any) {
    return this.svc.create(dto, req.user.id);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('status')       status?: string,
    @Query('workType')     workType?: string,
    @Query('clientName')   clientName?: string,
    @Query('serialNumber') serialNumber?: string,
    @Query('dateFrom')     dateFrom?: string,
    @Query('dateTo')       dateTo?: string,
  ) {
    return this.svc.findAll(req.user, { status, workType, clientName, serialNumber, dateFrom, dateTo });
  }

  @Get('stats')
  getStats(@Request() req: any) {
    if (req.user.role === UserRole.TECHNICIEN) return this.svc.getTechStats(req.user.id);
    return this.svc.getAdminStats();
  }

  @Get('history/machine')
  getMachineHistory(@Query('serialNumber') sn: string) {
    return this.svc.getMachineHistory(sn || '');
  }

  @Get('history/client')
  getClientHistory(@Query('clientName') cn: string) {
    return this.svc.getClientHistory(cn || '');
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.update(id, dto, req.user);
  }

  // ── Technicien workflow ────────────────────────────────────────────────────

  /** PATCH /interventions/:id/start — démarre le chrono */
  @Patch(':id/start')
  start(@Param('id') id: string, @Request() req: any) {
    return this.svc.startIntervention(id, req.user);
  }

  /** PATCH /interventions/:id/pause — met en pause + sauvegarde temps écoulé */
  @Patch(':id/pause')
  pause(@Param('id') id: string, @Body('workedMinutes') workedMinutes: number, @Request() req: any) {
    return this.svc.pauseIntervention(id, req.user, workedMinutes || 0);
  }

  /** PATCH /interventions/:id/finish — termine et soumet rapport complet */
  @Patch(':id/finish')
  finish(@Param('id') id: string, @Body() payload: any, @Request() req: any) {
    return this.svc.finishIntervention(id, req.user, payload);
  }

  /** PATCH /interventions/:id/photo — ajoute une photo */
  @Patch(':id/photo')
  addPhoto(@Param('id') id: string, @Body('photo') photo: string, @Request() req: any) {
    return this.svc.addPhoto(id, req.user, photo);
  }

  /** PATCH /interventions/:id/signature — sauvegarde signature client */
  @Patch(':id/signature')
  saveSignature(@Param('id') id: string, @Body('signature') signature: string, @Request() req: any) {
    return this.svc.saveSignature(id, req.user, signature);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}