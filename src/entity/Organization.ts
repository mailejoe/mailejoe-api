import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column
} from 'typeorm';

@Entity('organization')
export class Organization extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'unique_id' })
  uniqueId: string;

  @Column({ name: 'session_key' })
  sessionKey: string;

  @Column({ name: 'session_key_last_rotation' })
  sessionKeyLastRotation: Date;

  @Column({ name: 'registered_on' })
  registeredOn: Date;

  @Column({ name: 'min_pwd_len' })
  minPwdLen: number;

  @Column({ name: 'max_pwd_len' })
  maxPwdLen: number | null;

  @Column({ name: 'min_numeric_chars' })
  minNumericChars: number;

  @Column({ name: 'min_lowercase_chars' })
  minLowercaseChars: number;

  @Column({ name: 'min_uppercase_chars' })
  minUppercaseChars: number;

  @Column({ name: 'min_special_chars' })
  minSpecialChars: number;

  @Column({ name: 'special_char_set' })
  specialCharSet: string;

  @Column({ name: 'self_service_pwd_reset' })
  selfServicePwdReset: boolean;

  @Column({ name: 'pwd_reused' })
  pwdReused: number | null;

  @Column({ name: 'max_pwd_age' })
  maxPwdAge: number | null;

  @Column({ name: 'enforce_mfa' })
  enforceMfa: boolean;

  @Column('text', { name: 'trusted_cidrs', array: true })
  trustedCidrs: string[];

  @Column({ name: 'session_interval' })
  sessionInterval: string;

  @Column({ name: 'session_key_rotation' })
  sessionKeyRotation: number;

  @Column({ name: 'allow_username_reminder' })
  allowUsernameReminder: boolean;

  @Column({ name: 'allow_multiple_sessions' })
  allowMultipleSessions: boolean;

  @Column({ name: 'brute_force_limit' })
  bruteForceLimit: number;

  @Column({ name: 'brute_force_action' })
  bruteForceAction: string;
}