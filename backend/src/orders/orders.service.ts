import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderItemsDto } from './dto/update-order.dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import { Stock } from '../entities/stock.entity';
import { StockReservation } from '../entities/stock-reservation.entity';
import {
  StockMovement,
  StockMovementType,
} from '../entities/stock-movement.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(Product) private productRepository: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  private isSqlite(): boolean {
    const type = this.dataSource.options.type as string;
    return type === 'better-sqlite3' || type === 'sqlite';
  }

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOneBy(Customer, {
        id: dto.customerId,
      });
      if (!customer) throw new NotFoundException('Cliente não encontrado');

      const order = new Order();
      order.customerId = customer.id;
      order.status = OrderStatus.ORDERED;
      order.fulfillmentStrategy = dto.fulfillmentStrategy || 'ALL';
      order.items = [];
      let totalValue = 0;

      // Group items to prevent duplicate OrderItem rows for the same product
      const itemsMap = new Map<string, number>();
      for (const itemDto of dto.items) {
        const currentQty = itemsMap.get(itemDto.productId) || 0;
        itemsMap.set(itemDto.productId, currentQty + itemDto.quantity);
      }

      for (const [productId, quantity] of itemsMap.entries()) {
        const product = await manager.findOneBy(Product, { id: productId });
        if (!product)
          throw new NotFoundException(`Produto ${productId} não encontrado`);

        const orderItem = new OrderItem();
        orderItem.productId = product.id;
        orderItem.quantity = quantity;
        orderItem.unitPrice = product.price;
        order.items.push(orderItem);

        totalValue += Number(product.price) * quantity;
      }

      if (customer.isVip) {
        const discount = Number((totalValue * 0.10).toFixed(2));
        order.discountValue = discount;
        order.totalValue = Number((totalValue - discount).toFixed(2));
      } else {
        order.discountValue = 0;
        order.totalValue = totalValue;
      }

      return manager.save(order);
    });

    return order;
  }

  async approveOrder(orderId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      if (order.status !== OrderStatus.ORDERED) {
        throw new BadRequestException(
          `Não é possível aprovar um pedido que já se encontra no status ${order.status}.`,
        );
      }
      order.status = OrderStatus.APPROVED;
      return manager.save(order);
    });
  }

  async reserveOrder(orderId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Fetch order with items and customer
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: true, customer: true },
      });

      if (!order) throw new NotFoundException('Pedido não encontrado');
      if (order.status !== OrderStatus.APPROVED) {
        throw new BadRequestException(
          `O pedido precisa estar com status Aprovado para iniciar a separação de estoque. Status atual: ${order.status}`,
        );
      }

      const items = [...order.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );
      let newTotalValue = 0;
      let anyItemReserved = false;
      let stockFailure = false;

      for (const item of items) {
        // 2. Pessimistic lock on the specific stock
        const stock = await manager.findOne(Stock, {
          where: { productId: item.productId },
          ...(this.isSqlite() ? {} : { lock: { mode: 'pessimistic_write' } }),
        });

        if (!stock) {
          throw new NotFoundException(
            `Estoque para o produto ${item.productId} não encontrado`,
          );
        }

        // 3. Evaluate stock availability against fulfillment strategy
        let quantityToReserve = 0;

        if (stock.availableQuantity >= item.quantity) {
          quantityToReserve = item.quantity;
        } else if (order.fulfillmentStrategy === 'PARTIAL') {
          quantityToReserve = stock.availableQuantity;
        } else {
          // 'ALL' strategy with insufficient stock
          stockFailure = true;
          break;
        }

        if (quantityToReserve > 0) {
          // 4. Deduct stock
          stock.availableQuantity -= quantityToReserve;
          await manager.save(stock);

          // 5. Create reservation
          const reservation = new StockReservation();
          reservation.orderId = order.id;
          reservation.productId = item.productId;
          reservation.quantity = quantityToReserve;
          await manager.save(reservation);

          // 6. Create audit movement
          const movement = new StockMovement();
          movement.productId = item.productId;
          movement.quantity = -quantityToReserve;
          movement.type = StockMovementType.RESERVE;
          movement.referenceId = order.id;
          await manager.save(movement);

          // Update item quantity on the order and recalc value
          item.quantity = quantityToReserve;
          await manager.save(item);
          newTotalValue += Number(item.unitPrice) * quantityToReserve;
          anyItemReserved = true;
        } else {
          // 0 available, delete item from order if partial
          await manager.remove(item);
          // Remove from memory to prevent TypeORM cascade re-insertion error
          order.items = order.items.filter((i) => i.id !== item.id);
        }
      }

      if (stockFailure) {
        throw new ConflictException(
          `Estoque insuficiente para atender o pedido completamente (estratégia Tudo ou Nada).`,
        );
      }

      if (!anyItemReserved && items.length > 0) {
        // If nothing was reserved, the order cannot proceed.
        order.status = OrderStatus.ERROR;
        order.discountValue = 0;
        order.totalValue = 0;
      } else {
        order.status = OrderStatus.RESERVED;
        if (order.customer?.isVip) {
          const discount = Number((newTotalValue * 0.10).toFixed(2));
          order.discountValue = discount;
          order.totalValue = Number((newTotalValue - discount).toFixed(2));
        } else {
          order.discountValue = 0;
          order.totalValue = newTotalValue;
        }
      }
      return manager.save(order);
    });
  }

  async confirmOrder(orderId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      if (order.status !== OrderStatus.RESERVED) {
        throw new BadRequestException(
          'O pedido precisa estar Em Separação para ser concluído pela equipe de estoque.',
        );
      }

      const reservations = await manager.find(StockReservation, {
        where: { orderId: order.id },
      });
      reservations.sort((a, b) => a.productId.localeCompare(b.productId));

      for (const res of reservations) {
        const movement = new StockMovement();
        movement.productId = res.productId;
        movement.quantity = res.quantity;
        movement.type = StockMovementType.CONSUME_RESERVE;
        movement.referenceId = order.id;
        await manager.save(movement);

        await manager.remove(res);
      }

      order.status = OrderStatus.FINISHED;
      return manager.save(order);
    });
  }

  async cancelOrder(orderId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido não encontrado');

      if (
        order.status === OrderStatus.FINISHED ||
        order.status === OrderStatus.CANCELADO
      ) {
        throw new BadRequestException(
          `Não é possível cancelar um pedido que já está ${order.status === OrderStatus.FINISHED ? 'Concluído' : 'Cancelado'}.`,
        );
      }

      if (order.status === OrderStatus.RESERVED) {
        // Free reservations
        const reservations = await manager.find(StockReservation, {
          where: { orderId: order.id },
        });

        // Sort to avoid deadlocks when re-acquiring locks
        reservations.sort((a, b) => a.productId.localeCompare(b.productId));

        for (const res of reservations) {
          // Lock stock again to update
          const stock = await manager.findOne(Stock, {
            where: { productId: res.productId },
            ...(this.isSqlite() ? {} : { lock: { mode: 'pessimistic_write' } }),
          });

          if (stock) {
            stock.availableQuantity += res.quantity;
            await manager.save(stock);

            const movement = new StockMovement();
            movement.productId = res.productId;
            movement.quantity = res.quantity;
            movement.type = StockMovementType.CANCEL_RESERVE;
            movement.referenceId = order.id;
            await manager.save(movement);
          }

          await manager.remove(res);
        }
      }

      order.status = OrderStatus.CANCELADO;
      return manager.save(order);
    });
  }

  async updateOrderItems(
    orderId: string,
    dto: UpdateOrderItemsDto,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: true },
      });

      if (!order) throw new NotFoundException('Pedido não encontrado');

      if (
        order.status === OrderStatus.FINISHED ||
        order.status === OrderStatus.CANCELADO ||
        order.status === OrderStatus.ERROR
      ) {
        throw new BadRequestException(
          `Não é possível atualizar itens para um pedido no status ${order.status}`,
        );
      }

      // Map new items
      let newTotalValue = 0;
      const newItemsMap = new Map<string, number>(); // productId -> quantity

      for (const itemDto of dto.items) {
        const product = await manager.findOne(Product, {
          where: { id: itemDto.productId },
        });
        if (!product)
          throw new NotFoundException(`Produto ${itemDto.productId} não encontrado`);

        const currentQty = newItemsMap.get(itemDto.productId) || 0;
        newItemsMap.set(itemDto.productId, currentQty + itemDto.quantity);
      }

      if (order.status === OrderStatus.RESERVED) {
        // Collect existing reservations for this order
        const existingReservations = await manager.find(StockReservation, {
          where: { orderId: order.id },
        });
        const oldReservationMap = new Map<string, StockReservation>();
        for (const res of existingReservations) {
          oldReservationMap.set(res.productId, res);
        }

        // Collect all distinct product IDs involved in old or new items, sorted for deadlock prevention
        const allProductIds = Array.from(
          new Set([...oldReservationMap.keys(), ...newItemsMap.keys()]),
        ).sort();

        for (const productId of allProductIds) {
          const oldQty = oldReservationMap.get(productId)?.quantity || 0;
          const newQty = newItemsMap.get(productId) || 0;
          const delta = newQty - oldQty;

          if (delta === 0) continue;

          const stock = await manager.findOne(Stock, {
            where: { productId },
            ...(this.isSqlite() ? {} : { lock: { mode: 'pessimistic_write' } }),
          });
          if (!stock) {
            throw new NotFoundException(
              `Estoque para o produto ${productId} não encontrado`,
            );
          }

          if (delta > 0) {
            // Need more stock
            if (stock.availableQuantity < delta) {
              throw new ConflictException(
                `Estoque insuficiente para expandir a reserva do produto ${productId}. Disponível: ${stock.availableQuantity}, Necessário adicional: ${delta}`,
              );
            }
            stock.availableQuantity -= delta;
            await manager.save(stock);

            // Update or create reservation
            let reservation = oldReservationMap.get(productId);
            if (!reservation) {
              reservation = new StockReservation();
              reservation.orderId = order.id;
              reservation.productId = productId;
            }
            reservation.quantity = newQty;
            await manager.save(reservation);

            // Audit movement
            const movement = new StockMovement();
            movement.productId = productId;
            movement.quantity = -delta;
            movement.type = StockMovementType.RESERVE;
            movement.referenceId = order.id;
            await manager.save(movement);
          } else {
            // Return excess stock
            const returnQty = Math.abs(delta);
            stock.availableQuantity += returnQty;
            await manager.save(stock);

            const reservation = oldReservationMap.get(productId);
            if (reservation) {
              if (newQty > 0) {
                reservation.quantity = newQty;
                await manager.save(reservation);
              } else {
                await manager.remove(reservation);
              }
            }

            // Audit movement
            const movement = new StockMovement();
            movement.productId = productId;
            movement.quantity = returnQty;
            movement.type = StockMovementType.CANCEL_RESERVE;
            movement.referenceId = order.id;
            await manager.save(movement);
          }
        }
      }

      await manager.delete(OrderItem, { orderId });
      order.items = [];
      for (const [productId, qty] of newItemsMap.entries()) {
        const product = await manager.findOne(Product, {
          where: { id: productId },
        });
        const orderItem = new OrderItem();
        orderItem.orderId = order.id;
        orderItem.productId = productId;
        orderItem.quantity = qty;
        orderItem.unitPrice = product!.price;
        order.items.push(orderItem);
        newTotalValue += Number(product!.price) * qty;
      }

      if (order.customer?.isVip) {
        const discount = Number((newTotalValue * 0.10).toFixed(2));
        order.discountValue = discount;
        order.totalValue = Number((newTotalValue - discount).toFixed(2));
      } else {
        order.discountValue = 0;
        order.totalValue = newTotalValue;
      }

      return manager.save(order);
    });
  }

  async getStats(customerId?: string) {
    const qb = this.orderRepository.createQueryBuilder('order');
    if (customerId) {
      qb.where('order.customerId = :customerId', { customerId });
    }
    const orders = await qb
      .select(['order.id', 'order.status', 'order.totalValue'])
      .getMany();

    const totalOrders = orders.length;
    const awaitingSeparation = orders.filter(
      (o) => o.status === OrderStatus.APPROVED,
    ).length;
    const inSeparation = orders.filter(
      (o) => o.status === OrderStatus.RESERVED,
    ).length;
    const finishedTotalValue = orders
      .filter((o) => o.status === OrderStatus.FINISHED)
      .reduce((sum, o) => sum + Number(o.totalValue || 0), 0);

    return {
      totalOrders,
      awaitingSeparation,
      inSeparation,
      finishedTotalValue,
    };
  }

  async findAll(
    customerId?: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number; totalPages: number }> {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 10);

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.createdAt', 'DESC')
      .skip((p - 1) * l)
      .take(l);

    if (customerId) {
      qb.andWhere('order.customerId = :customerId', { customerId });
    }

    if (status && status !== 'ALL') {
      qb.andWhere('order.status = :status', { status });
    }

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(order.id) LIKE :s OR LOWER(customer.name) LIKE :s OR LOWER(customer.email) LIKE :s)',
        { s },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    };
  }

  findOne(id: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { id },
      relations: {
        customer: true,
        items: {
          product: true,
        },
      },
    });
  }
}
