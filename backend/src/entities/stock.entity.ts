import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  OneToOne,
  Check,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('stocks')
@Check(`"availableQuantity" >= 0`)
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @OneToOne(() => Product, (product) => product.stock)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('int', { default: 0 })
  availableQuantity: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
