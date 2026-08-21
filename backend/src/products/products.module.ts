import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from '../entities/product.entity';
import { Stock } from '../entities/stock.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { InventoryController } from './inventory.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Stock, StockMovement]),
    OrdersModule,
  ],
  controllers: [ProductsController, InventoryController],
  providers: [ProductsService],
})
export class ProductsModule {}
