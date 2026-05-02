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
  @Roles(UserRole.ADMIN)
  create(@Body() dto: any, @Request() req) {
    return this.tasksService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.tasksService.findAll(req.user);
  }

  @Get('my-stats')
  @Roles(UserRole.LIVREUR)
  getMyStats(@Request() req) {
    return this.tasksService.getLivreurStats(req.user.id);
  }

  // MOD 8a: admin fetches tasks of a specific livreur to print summary
  @Get('by-livreur/:livreurId')
  @Roles(UserRole.ADMIN)
  getByLivreur(
    @Param('livreurId') livreurId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tasksService.getTasksByLivreur(livreurId, from, to);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(id, req.user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.tasksService.update(id, dto, req.user);
  }

  // MOD 6: livreur clicks "Start delivery"
  @Patch(':id/start-delivery')
  @Roles(UserRole.LIVREUR)
  startDelivery(@Param('id') id: string, @Request() req) {
    return this.tasksService.startDelivery(id, req.user);
  }

  // MOD 6: livreur clicks "Finish delivery"
  @Patch(':id/finish-delivery')
  @Roles(UserRole.LIVREUR)
  finishDelivery(@Param('id') id: string, @Request() req) {
    return this.tasksService.finishDelivery(id, req.user);
  }

  // MOD 6: admin adds unexpected extra fees
  @Patch(':id/extra-fees')
  @Roles(UserRole.ADMIN)
  addExtraFees(
    @Param('id') id: string,
    @Body() body: { extraFees: number; extraFeesNote?: string },
  ) {
    return this.tasksService.addExtraFees(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
