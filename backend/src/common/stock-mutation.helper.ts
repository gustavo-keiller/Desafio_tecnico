import { EntityManager, DataSource } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Stock } from '../entities/stock.entity';
import {
  StockMovement,
  StockMovementType,
} from '../entities/stock-movement.entity';

/**
 * Ponto único, centralizado e atômico de mutação de saldo de estoque.
 * Aplica lock pessimista (ou compatível com SQLite), valida saldo não-negativo
 * e gera 1:1 o registro em StockMovement.
 */
export async function applyStockMutation(
  dataSource: DataSource,
  manager: EntityManager,
  productId: string,
  delta: number,
  type: StockMovementType,
  referenceId?: string,
): Promise<Stock> {
  const typeormDriver = dataSource.options.type as string;
  const isSqlite =
    typeormDriver === 'better-sqlite3' || typeormDriver === 'sqlite';

  const stock = await manager.findOne(Stock, {
    where: { productId },
    ...(isSqlite ? {} : { lock: { mode: 'pessimistic_write' } }),
  });

  if (!stock) {
    throw new NotFoundException(
      `Estoque não encontrado para o produto ${productId}`,
    );
  }

  stock.availableQuantity += delta;
  if (stock.availableQuantity < 0) {
    throw new ConflictException(
      `Estoque insuficiente para o produto. Saldo disponível: ${stock.availableQuantity - delta}`,
    );
  }

  await manager.save(Stock, stock);

  const movement = new StockMovement();
  movement.productId = productId;
  movement.quantity = delta;
  movement.type = type;
  movement.referenceId = referenceId;
  await manager.save(StockMovement, movement);

  return stock;
}
