import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Stock } from '../entities/stock.entity';
import {
  StockMovement,
  StockMovementType,
} from '../entities/stock-movement.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Product) private productRepository: Repository<Product>,
    @InjectRepository(Stock) private stockRepository: Repository<Stock>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
  ) {}

  findAll(page = 1, limit = 50) {
    return this.productRepository.find({
      relations: { stock: true },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  async getMovements(page = 1, limit = 50) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(100, Number(limit) || 50));
    return this.stockMovementRepository.find({
      relations: { product: true },
      order: { createdAt: 'DESC' },
      take: l,
      skip: (p - 1) * l,
    });
  }

  async createProduct(name: string, price: number) {
    return this.dataSource.transaction(async (manager) => {
      const product = new Product();
      product.name = name;
      product.price = price;
      await manager.save(product);

      const stock = new Stock();
      stock.productId = product.id;
      stock.availableQuantity = 0;
      await manager.save(stock);

      return product;
    });
  }

  async getStock(productId: string) {
    const stock = await this.stockRepository.findOneBy({ productId });
    return stock || { availableQuantity: 0 };
  }

  async replenishStock(productId: string, quantity: number) {
    return this.dataSource.transaction(async (manager) => {
      const type = this.dataSource.options.type as string;
      const isSqlite = type === 'better-sqlite3' || type === 'sqlite';
      const stock = await manager.findOne(Stock, {
        where: { productId },
        ...(isSqlite ? {} : { lock: { mode: 'pessimistic_write' } }),
      });
      if (!stock) throw new NotFoundException('Estoque não encontrado');

      stock.availableQuantity += quantity;
      await manager.save(stock);

      const movement = new StockMovement();
      movement.productId = productId;
      movement.quantity = quantity;
      movement.type = StockMovementType.IN;
      await manager.save(movement);

      return stock;
    });
  }
}
