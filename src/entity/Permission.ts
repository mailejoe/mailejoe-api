import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from './Role';

@Entity('role-permission')
export class Permission extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Role)
  @JoinColumn({ name: 'role_id', referencedColumnName: 'id' })
  role: Role;

  @Column({ name: 'permission' })
  permission: string;
}