import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { RolesGuard } from '../roles/roles.guard';
import { Roles, Role } from '../roles/roles.decorator';
import { IsArray, IsString } from 'class-validator';

class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

@ApiTags('Permissões')
@Controller('permissions')
@UseGuards(RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('catalog')
  @Roles(Role.ADMIN)
  getCatalog() {
    return this.permissionsService.getCatalog();
  }

  @Get('roles')
  @Roles(Role.ADMIN)
  getAllRolePermissions() {
    return this.permissionsService.getAllRolePermissions();
  }

  @Put('roles/:role')
  @Roles(Role.ADMIN)
  updateRolePermissions(
    @Param('role') role: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.permissionsService.updateRolePermissions(role, dto.permissions);
  }
}
