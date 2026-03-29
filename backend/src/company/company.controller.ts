import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  get() {
    return this.companyService.get();
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Body() dto: any) {
    return this.companyService.update(dto);
  }
}
