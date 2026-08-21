import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrderQueueService } from './order-queue.service';
import { OrdersController } from './orders.controller';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import { Stock } from '../entities/stock.entity';
import { StockReservation } from '../entities/stock-reservation.entity';
import { StockMovement } from '../entities/stock-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      Customer,
      Stock,
      StockReservation,
      StockMovement,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderQueueService],
  exports: [OrdersService, OrderQueueService],
})
export class OrdersModule {}
