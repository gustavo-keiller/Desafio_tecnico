import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService, CreateUserDto, UpdateUserDto } from './users.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { UserRole } from '../entities/user.entity';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
} from 'class-validator';

class CreateUserBody implements CreateUserDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsBoolean() isVip?: boolean;
  @IsOptional() @IsArray() customPermissions?: string[] | null;
}

class UpdateUserBody implements UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() isVip?: boolean;
  @IsOptional() customPermissions?: string[] | null;
}

@ApiTags('Usuários')
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USERS_MANAGE)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.USERS_MANAGE)
  create(@Body() dto: CreateUserBody) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateUserBody) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/vip')
  @RequirePermissions(Permission.USERS_MANAGE)
  setVip(@Param('id') id: string, @Body('isVip') isVip: boolean) {
    return this.usersService.setVipStatus(id, Boolean(isVip));
  }
}
