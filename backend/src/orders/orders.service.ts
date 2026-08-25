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

import { applyStockMutation } from '../common/stock-mutation.helper';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
  ) {}

  private isSqlite(): boolean {
    const type = this.dataSource.options.type as string;
    return type === 'better-sqlite3' || type === 'sqlite';
  }

  /**
   * Ponto centralizado e atômico de mutação de saldo de estoque.
   */
  private async applyStockMutation(
    manager: EntityManager,
    productId: string,
    delta: number,
    type: StockMovementType,
    referenceId?: string,
  ): Promise<Stock> {
    return applyStockMutation(
      this.dataSource,
      manager,
      productId,
      delta,
      type,
      referenceId,
    );
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
        const discount = Number((totalValue * 0.1).toFixed(2));
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
          // 4 & 5. Atomically deduct stock and create audit ledger movement
          await this.applyStockMutation(
            manager,
            item.productId,
            -quantityToReserve,
            StockMovementType.RESERVE,
            order.id,
          );

          // 6. Create reservation record
          const reservation = new StockReservation();
          reservation.orderId = order.id;
          reservation.productId = item.productId;
          reservation.quantity = quantityToReserve;
          await manager.save(reservation);

          // Update item quantity on the order and recalc value
          item.quantity = quantityToReserve;
          await manager.save(item);
          newTotalValue += Number(item.unitPrice) * quantityToReserve;
          anyItemReserved = true;
        } else {
          // In partial fulfillment with 0 stock, preserve item history with quantity 0
          item.quantity = 0;
          await manager.save(item);
        }
      }

      if (stockFailure) {
        throw new ConflictException(
          `Estoque insuficiente para atender o pedido completamente (estratégia Tudo ou Nada).`,
        );
      }

      if (!anyItemReserved && items.length > 0) {
        throw new ConflictException(
          `Nenhum item do pedido possui estoque disponível no momento para atendimento.`,
        );
      }

      order.status = OrderStatus.RESERVED;
      const hasVipDiscount =
        Number(order.discountValue) > 0 || Boolean(order.customer?.isVip);
      if (hasVipDiscount) {
        const discount = Number((newTotalValue * 0.1).toFixed(2));
        order.discountValue = discount;
        order.totalValue = Number((newTotalValue - discount).toFixed(2));
      } else {
        order.discountValue = 0;
        order.totalValue = newTotalValue;
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

      // Consome e remove as reservas temporárias (o débito contábil de saldo já ocorreu na reserva)
      const reservations = await manager.find(StockReservation, {
        where: { orderId: order.id },
      });

      for (const res of reservations) {
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
        order.status === OrderStatus.CANCELED
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
          await this.applyStockMutation(
            manager,
            res.productId,
            res.quantity,
            StockMovementType.CANCEL_RESERVE,
            order.id,
          );
          await manager.remove(res);
        }
      }

      order.status = OrderStatus.CANCELED;
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
        relations: { items: true, customer: true },
      });

      if (!order) throw new NotFoundException('Pedido não encontrado');

      if (
        order.status === OrderStatus.FINISHED ||
        order.status === OrderStatus.CANCELED ||
        order.status === OrderStatus.ERROR
      ) {
        throw new BadRequestException(
          `Não é possível atualizar itens para um pedido no status ${order.status}`,
        );
      }

      // Map new items
      const newItemsMap = new Map<string, number>();
      for (const itemDto of dto.items) {
        newItemsMap.set(
          itemDto.productId,
          (newItemsMap.get(itemDto.productId) || 0) + itemDto.quantity,
        );
      }

      // Map old items
      const oldItemsMap = new Map<string, number>();
      for (const item of order.items || []) {
        oldItemsMap.set(item.productId, item.quantity);
      }

      let newTotalValue = 0;

      // If order is currently RESERVED, dynamically adjust stock reservations under lock
      if (order.status === OrderStatus.RESERVED) {
        const allProductIds = Array.from(
          new Set([...newItemsMap.keys(), ...oldItemsMap.keys()]),
        );
        allProductIds.sort();

        const oldReservations = await manager.find(StockReservation, {
          where: { orderId: order.id },
        });
        const oldReservationMap = new Map<string, StockReservation>();
        for (const res of oldReservations) {
          oldReservationMap.set(res.productId, res);
        }

        for (const productId of allProductIds) {
          const oldQty = oldItemsMap.get(productId) || 0;
          const newQty = newItemsMap.get(productId) || 0;
          const delta = newQty - oldQty;

          if (delta === 0) continue;

          if (delta > 0) {
            let actualDelta = delta;
            if (order.fulfillmentStrategy === 'PARTIAL') {
              const stock = await manager.findOne(Stock, {
                where: { productId },
                ...(this.isSqlite()
                  ? {}
                  : { lock: { mode: 'pessimistic_write' } }),
              });
              const avail = stock ? stock.availableQuantity : 0;
              actualDelta = Math.min(delta, Math.max(0, avail));
            }

            if (actualDelta > 0) {
              await this.applyStockMutation(
                manager,
                productId,
                -actualDelta,
                StockMovementType.RESERVE,
                order.id,
              );

              let reservation = oldReservationMap.get(productId);
              if (!reservation) {
                reservation = new StockReservation();
                reservation.orderId = order.id;
                reservation.productId = productId;
              }
              reservation.quantity = oldQty + actualDelta;
              await manager.save(reservation);
              newItemsMap.set(productId, oldQty + actualDelta);
            } else if (order.fulfillmentStrategy !== 'PARTIAL') {
              await this.applyStockMutation(
                manager,
                productId,
                -delta,
                StockMovementType.RESERVE,
                order.id,
              );
            }
          } else {
            // Return excess stock (return Math.abs(delta))
            const returnQty = Math.abs(delta);
            await this.applyStockMutation(
              manager,
              productId,
              returnQty,
              StockMovementType.CANCEL_RESERVE,
              order.id,
            );

            const reservation = oldReservationMap.get(productId);
            if (reservation) {
              if (newQty > 0) {
                reservation.quantity = newQty;
                await manager.save(reservation);
              } else {
                await manager.remove(reservation);
              }
            }
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

      const hasVipDiscount =
        Number(order.discountValue) > 0 || Boolean(order.customer?.isVip);
      if (hasVipDiscount) {
        const discount = Number((newTotalValue * 0.1).toFixed(2));
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
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
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
