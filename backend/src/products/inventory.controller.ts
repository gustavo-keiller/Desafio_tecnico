import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsInt, Min } from 'class-validator';
import { ProductsService } from './products.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import {
  OrderQueueService,
  QueuePriority,
} from '../orders/order-queue.service';

class ReplenishDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly orderQueueService: OrderQueueService,
  ) {}

  @Get('movements')
  @RequirePermissions(Permission.INVENTORY_READ)
  getMovements(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.productsService.getMovements(page, limit);
  }

  @Post('replenish')
  @RequirePermissions(Permission.INVENTORY_REPLENISH)
  replenishStock(@Body() dto: ReplenishDto) {
    return this.orderQueueService.enqueue(
      QueuePriority.REPLENISH,
      () => this.productsService.replenishStock(dto.productId, dto.quantity),
      `Reposição de Estoque (${dto.productId.slice(0, 8)}, +${dto.quantity})`,
    );
  }
}
