import { Check, Column, Entity, Index, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { BalanceEntity } from './balance.entity';

@Index('idx_users_email', ['email'])
@Check('chk_users_email_format', "email LIKE '%@%.%'")
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60, nullable: false })
  password: string;

  @Column({ type: 'varchar', length: 256, nullable: false, unique: true })
  email: string;

  @OneToOne(() => BalanceEntity, (balance) => balance.user)
  balance: BalanceEntity;
}
