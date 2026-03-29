import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
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

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(id, req.user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.tasksService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
