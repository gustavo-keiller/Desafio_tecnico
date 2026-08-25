import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Customer } from './customer.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  ORDERED = 'ORDERED',
  APPROVED = 'APPROVED',
  RESERVED = 'RESERVED',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
  CANCELED = 'CANCELED',
}

@Entity('orders')
@Check(`"totalValue" >= 0`)
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.orders)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Index()
  @Column({
    type: 'nvarchar',
    length: 50,
    default: OrderStatus.ORDERED,
  })
  status: OrderStatus;

  @Column({
    type: 'nvarchar',
    length: 20,
    default: 'ALL',
  })
  fulfillmentStrategy: 'ALL' | 'PARTIAL';

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountValue: number;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn()
  version: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
