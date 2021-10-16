import {
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Organization } from './Organization';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;
}