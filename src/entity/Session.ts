import { Exclude, classToPlain } from 'class-transformer';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { isTest } from '../utils/env';
import { Organization } from './Organization';
import { User } from './User';

@Entity('session')
export class Session extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'unique_id', select: false })
  @Exclude({ toPlainOnly: true })
  uniqueId: string;

  @Column({ name: 'mfa_state' })
  mfaState: string;
  
  @Column({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_activity_at' })
  lastActivityAt: Date | null;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'user_agent' })
  userAgent: string;

  @Column({ name: 'ip' })
  ip: string;

  toJSON() {
    if (isTest()) {
      return this.toJSON();
    }

    return classToPlain(this);
  }
}