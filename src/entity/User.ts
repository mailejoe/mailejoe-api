import { randomBytes } from 'crypto';
import { Exclude, classToPlain } from 'class-transformer';
import {
  DateTime,
} from 'luxon';
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
import { Role } from './Role';

const USER_RESET_TOKEN_LEN = 64;

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;

  @OneToOne(() => Role)
  @JoinColumn({ name: 'role_id', referencedColumnName: 'id' })
  role: Role;

  @Column({ name: 'email' })
  email: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'pwd_hash', select: false })
  @Exclude({ toPlainOnly: true })
  pwdHash: string | null;

  @Column({ name: 'mfa_secret', select: false })
  @Exclude({ toPlainOnly: true })
  mfaSecret: string | null;

  @Column({ name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({ name: 'init_token', select: false })
  @Exclude({ toPlainOnly: true })
  initToken: string | null;

  @Column({ name: 'reset_token', select: false })
  @Exclude({ toPlainOnly: true })
  resetToken: string | null;

  @Column({ name: 'token_expiration', select: false })
  @Exclude({ toPlainOnly: true })
  tokenExpiration: Date | null;

  @Column({ name: 'archived' })
  archived: boolean;

  toJSON() {
    if (isTest()) {
      return this.toJSON();
    }

    return classToPlain(this);
  }

  static defaultNewUser({ org, email, firstName, lastName }): User {
    const newUser = new User();
    newUser.organization = org;
    newUser.email = email;
    newUser.firstName = firstName;
    newUser.lastName = lastName;
    newUser.pwdHash = null;
    newUser.mfaSecret = null;
    newUser.mfaEnabled = false;
    newUser.resetToken = randomBytes(USER_RESET_TOKEN_LEN).toString('hex');
    newUser.tokenExpiration = DateTime.now().plus({ days: 3 }).toUTC().toJSDate();
    newUser.archived = false;
    return newUser;
  }

  static findByEmail(email: string): Promise<User> {
    return this.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
  }

  static createNewResetToken(): string {
    return randomBytes(USER_RESET_TOKEN_LEN).toString('hex').slice(0, USER_RESET_TOKEN_LEN);
  }
}