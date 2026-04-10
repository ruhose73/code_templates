import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { OrderEntity } from './order.entity';

@Index('idx_order_items_order_id', ['orderId'])
@Check('chk_order_items_quantity', '"quantity" > 0')
@Check('chk_order_items_price', '"price" > 0')
@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  orderId: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  productId: string;

  @Column({ type: 'integer', nullable: false })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  price: number;

  @ManyToOne(() => OrderEntity, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
