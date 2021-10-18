import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Session } from './Session';
import { User } from './User';

@Entity('user-access-history')
export class UserAccessHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;

  @OneToOne(() => Session)
  @JoinColumn({ name: 'session_id', referencedColumnName: 'id' })
  session: Session;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'programmatic' })
  programmatic: boolean;

  @Column({ name: 'ip' })
  ip: string;
  
  @Column({ name: 'operating_system' })
  operatingSystem: string | null;

  @Column({ name: 'mobile' })
  mobile: boolean | null;

  @Column({ name: 'platform' })
  platform: string | null;

  @Column({ name: 'engine_name' })
  engineName: string | null;

  @Column({ name: 'engine_version' })
  engineVersion: string | null;

  @Column({ name: 'browser_name' })
  browserName: string | null;

  @Column({ name: 'browser_version' })
  browserVersion: string | null;

  @Column({ name: 'localization' })
  localization: string;

  @Column({ name: 'coutry_code' })
  coutryCode: string | null;

  @Column({ name: 'user_agent' })
  userAgent: string;

  @Column({ name: 'region' })
  region: string | null;

  @Column({ name: 'city' })
  city: string | null;

  @Column({ name: 'latitude' })
  latitude: number | null;

  @Column({ name: 'longitude' })
  longitude: number | null;

  @Column({ name: 'login' })
  login: Date;
}