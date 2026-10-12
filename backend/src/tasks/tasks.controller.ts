import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Patch, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  create(@Body() dto: any, @Request() req) {
    return this.tasksService.create(dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.LIVREUR)
  findAll(@Request() req) {
    return this.tasksService.findAll(req.user);
  }

  @Get('my-tasks')
  @Roles(UserRole.LIVREUR)
  getMyTasks(@Request() req) {
    return this.tasksService.findAll(req.user);
  }

  @Get('my-stats')
  @Roles(UserRole.LIVREUR)
  getMyStats(@Request() req) {
    return this.tasksService.getLivreurStats(req.user.id);
  }

  @Get(':id/delivery-note')
  @Roles(UserRole.LIVREUR)
  getDeliveryNote(@Param('id') id: string, @Request() req) {
    return this.tasksService.getDeliveryNote(id, req.user);
  }

  // MOD 8a: admin fetches tasks of a specific livreur to print summary
  @Get('by-livreur/:livreurId')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  getByLivreur(
    @Param('livreurId') livreurId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tasksService.getTasksByLivreur(livreurId, from, to);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.LIVREUR)
  async findOne(@Param('id') id: string, @Request() req) {
    const task = await this.tasksService.findOne(id, req.user);
    return req.user.role === UserRole.LIVREUR
      ? this.tasksService.presentForLivreur(task)
      : task;
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.LIVREUR)
  update(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.tasksService.update(id, dto, req.user);
  }

  // MOD 6: livreur or admin starts delivery
  @Patch(':id/start-delivery')
  @Roles(UserRole.LIVREUR, UserRole.ADMIN, UserRole.COMMERCIAL)
  startDelivery(@Param('id') id: string, @Request() req) {
    return this.tasksService.startDelivery(id, req.user);
  }

  // MOD 6: livreur or admin finishes delivery
  @Patch(':id/finish-delivery')
  @Roles(UserRole.LIVREUR, UserRole.ADMIN, UserRole.COMMERCIAL)
  finishDelivery(@Param('id') id: string, @Request() req) {
    return this.tasksService.finishDelivery(id, req.user);
  }

  @Patch(':id/reopen-delivery')
  @Roles(UserRole.LIVREUR, UserRole.ADMIN, UserRole.COMMERCIAL)
  reopenDelivery(@Param('id') id: string, @Request() req) {
    return this.tasksService.reopenDelivery(id, req.user);
  }

  // MOD 6: admin adds unexpected extra fees
  @Patch(':id/extra-fees')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  addExtraFees(
    @Param('id') id: string,
    @Body() body: { extraFees: number; extraFeesNote?: string },
  ) {
    return this.tasksService.addExtraFees(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
