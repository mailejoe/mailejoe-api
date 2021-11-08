import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity('rate-limit')
export class RateLimit extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'client_identifier' })
  clientIdentifier: string;

  @Column({ name: 'route' })
  route: string;

  @Column({ name: 'call_count' })
  callCount: number;

  @Column({ name: 'first_called_on' })
  lastUsedOn: Date;
}