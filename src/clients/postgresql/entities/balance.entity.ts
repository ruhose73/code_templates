import { Check, Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UserEntity } from './user.entity';

@Index('idx_balances_user_id', ['userId'])
@Check('chk_balances_non_negative', '"balance" >= 0 AND "bonusBalance" >= 0')
@Entity('balances')
export class BalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, nullable: false })
  balance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, nullable: false })
  bonusBalance: number;

  @Column({ type: 'uuid', nullable: false, unique: true })
  userId: string;

  @OneToOne(() => UserEntity, (user) => user.balance)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
