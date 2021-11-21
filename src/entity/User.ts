import { randomBytes } from 'crypto';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Organization } from './Organization';

const USER_RESET_TOKEN_LEN = 64;

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
  organization: Organization;

  @Column({ name: 'email' })
  email: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'pwd_hash' })
  pwdHash: string | null;

  @Column({ name: 'mfa_secret' })
  mfaSecret: string | null;

  @Column({ name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({ name: 'reset_token' })
  resetToken: string | null;

  @Column({ name: 'archived' })
  archived: boolean;

  static defaultNewUser({ org, email, firstName, lastName }): User {
    const newUser = new User();
    newUser.organization = org;
    newUser.email = email;
    newUser.firstName = firstName;
    newUser.lastName = lastName;
    newUser.pwdHash = null;
    newUser.mfaSecret = null;
    newUser.mfaEnabled = false;
    newUser.resetToken = randomBytes(USER_RESET_TOKEN_LEN).toString('base64').slice(0, USER_RESET_TOKEN_LEN);
    return newUser;
  }

  static findByEmail(email: string): Promise<User> {
    return this.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
  }

  static findByVerificationToken(token: string): Promise<User> {
    return this.createQueryBuilder('user')
      .where('user.verifyToken = :token', { token })
      .getOne();
  }

  static createNewResetToken(): string {
    return randomBytes(USER_RESET_TOKEN_LEN).toString('base64').slice(0, USER_RESET_TOKEN_LEN);
  }
}