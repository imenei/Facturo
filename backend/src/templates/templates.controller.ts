import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('types')
  getTypes() {
    return this.templatesService.getTypes();
  }

  @Get()
  findAll() {
    return this.templatesService.findAll();
  }

  @Get('default')
  getDefault() {
    return this.templatesService.getDefault();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  create(@Body() dto: any) {
    return this.templatesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.templatesService.update(id, dto);
  }

  @Post(':id/set-default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  setDefault(@Param('id') id: string) {
    return this.templatesService.setDefault(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
