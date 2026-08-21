import { Controller, Get, Param, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';
import { ProductsService } from './products.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';

class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}

@ApiTags('Products')
@Controller('products')
@UseGuards(RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCTS_READ)
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const p = page ? Number(page) : 1;
    const l = limit ? Number(limit) : 50;
    return this.productsService.findAll(p, l);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCTS_CREATE)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto.name, dto.price);
  }

  @Get(':id/stock')
  @RequirePermissions(Permission.INVENTORY_READ, Permission.PRODUCTS_READ)
  getStock(@Param('id') id: string) {
    return this.productsService.getStock(id);
  }
}
