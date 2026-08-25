import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  RESERVE = 'RESERVE',
  CANCEL_RESERVE = 'CANCEL_RESERVE',
  CONSUME_RESERVE = 'CONSUME_RESERVE',
}

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('int')
  quantity: number;

  @Column({
    type: 'nvarchar',
    length: 50,
  })
  type: StockMovementType;

  @Index()
  @Column({ nullable: true })
  referenceId?: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
