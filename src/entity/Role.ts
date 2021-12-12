import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Permission } from './Permission';

@Entity('role')
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'description' })
  description: string;

  @Column({ name: 'archived' })
  archived: boolean;

  @OneToMany(() => Permission, permission => permission.role)
  permissions: Permission[];

  static defaultAdminRole(translate, locale): Role {
    const newAdminRole = new Role();
    newAdminRole.name = translate({ phrase: 'roles.administrator', locale });
    newAdminRole.description = translate({ phrase: 'roles.administratorDescription', locale });
    newAdminRole.archived = false;
    return newAdminRole;
  }
}