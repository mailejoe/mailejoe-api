import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';

@Entity('audit-log')
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;

  @Column({ name: 'entity_id' })
  entityId: number | null;

  @Column({ name: 'entity_type' })
  entityType: string;

  @Column({ name: 'operation' })
  operation: string;
  
  @Column({ name: 'info' })
  info: string | null;

  @Column({ name: 'generated_on' })
  generatedOn: Date;

  @Column({ name: 'generated_by' })
  generatedBy: number | null;

  @Column({ name: 'ip' })
  ip: string;

  @Column({ name: 'country_code' })
  countryCode: string | null;
}