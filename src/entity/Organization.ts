import { Exclude, classToPlain } from 'class-transformer';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column
} from 'typeorm';

const ORG_UNIQUE_ID_LEN = 32;
const DEFAULT_MIN_PWD_LEN = 12;
const SPECIAL_CHAR_SET = '#$%^&-_*!.?=+';
const DEFAULT_MAX_PWD_AGE = 30; // 30 days
const DEFAULT_SESSION_INTERVAL = '02:00'; // 2 hours
const DEFAULT_SESSION_KEY_ROTATION = 14; // 14 days
const DEFAULT_BRUTE_FORCE_LIMIT = 5;
const DEFAULT_BRUTE_FORCE_ACTION = 'block';

@Entity('organization')
export class Organization extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'unique_id', select: false })
  @Exclude({ toPlainOnly: true })
  uniqueId: string;

  @Column({ name: 'encryption_key', select: false })
  @Exclude({ toPlainOnly: true })
  encryptionKey: string;

  @Column({ name: 'session_key_last_rotation', select: false })
  @Exclude({ toPlainOnly: true })
  sessionKeyLastRotation: Date;

  @Column({ name: 'registered_on' })
  registeredOn: Date;

  @Column({ name: 'min_pwd_len', select: false })
  @Exclude({ toPlainOnly: true })
  minPwdLen: number;

  @Column({ name: 'max_pwd_len', select: false })
  @Exclude({ toPlainOnly: true })
  maxPwdLen: number | null;

  @Column({ name: 'min_numeric_chars', select: false })
  @Exclude({ toPlainOnly: true })
  minNumericChars: number;

  @Column({ name: 'min_lowercase_chars', select: false })
  @Exclude({ toPlainOnly: true })
  minLowercaseChars: number;

  @Column({ name: 'min_uppercase_chars', select: false })
  @Exclude({ toPlainOnly: true })
  minUppercaseChars: number;

  @Column({ name: 'min_special_chars', select: false })
  @Exclude({ toPlainOnly: true })
  minSpecialChars: number;

  @Column({ name: 'special_char_set', select: false })
  @Exclude({ toPlainOnly: true })
  specialCharSet: string;

  @Column({ name: 'self_service_pwd_reset', select: false })
  @Exclude({ toPlainOnly: true })
  selfServicePwdReset: boolean;

  @Column({ name: 'pwd_reused', select: false })
  @Exclude({ toPlainOnly: true })
  pwdReused: number | null;

  @Column({ name: 'max_pwd_age', select: false })
  @Exclude({ toPlainOnly: true })
  maxPwdAge: number | null;

  @Column({ name: 'enforce_mfa', select: false })
  @Exclude({ toPlainOnly: true })
  enforceMfa: boolean;

  @Column('text', { name: 'trusted_cidrs', array: true, select: false })
  @Exclude({ toPlainOnly: true })
  trustedCidrs: string[];

  @Column({ name: 'session_interval', select: false })
  @Exclude({ toPlainOnly: true })
  sessionInterval: string;

  @Column({ name: 'session_key_rotation', select: false })
  @Exclude({ toPlainOnly: true })
  sessionKeyRotation: number;

  @Column({ name: 'allow_username_reminder', select: false })
  @Exclude({ toPlainOnly: true })
  allowUsernameReminder: boolean;

  @Column({ name: 'allow_multiple_sessions', select: false })
  @Exclude({ toPlainOnly: true })
  allowMultipleSessions: boolean;

  @Column({ name: 'brute_force_limit', select: false })
  @Exclude({ toPlainOnly: true })
  bruteForceLimit: number;

  @Column({ name: 'brute_force_action', select: false })
  @Exclude({ toPlainOnly: true })
  bruteForceAction: string;

  toJSON() {
    return classToPlain(this);
  }

  static defaultNewOrganization(orgName: string): Organization {
    const newOrg = new Organization();
    newOrg.name = orgName;
    newOrg.uniqueId = randomBytes(ORG_UNIQUE_ID_LEN).toString('hex');
    newOrg.sessionKeyLastRotation = DateTime.now().toUTC().toJSDate();
    newOrg.registeredOn = DateTime.now().toUTC().toJSDate();
    newOrg.minPwdLen = DEFAULT_MIN_PWD_LEN;
    newOrg.maxPwdLen = null;
    newOrg.minLowercaseChars = 1;
    newOrg.minUppercaseChars = 1;
    newOrg.minNumericChars = 1;
    newOrg.minSpecialChars = 1;
    newOrg.specialCharSet = SPECIAL_CHAR_SET;
    newOrg.selfServicePwdReset = true;
    newOrg.pwdReused = null;
    newOrg.maxPwdAge = DEFAULT_MAX_PWD_AGE;
    newOrg.enforceMfa = true;
    newOrg.trustedCidrs = [];
    newOrg.sessionInterval = DEFAULT_SESSION_INTERVAL;
    newOrg.sessionKeyRotation = DEFAULT_SESSION_KEY_ROTATION;
    newOrg.allowUsernameReminder = true;
    newOrg.allowMultipleSessions = true;
    newOrg.bruteForceLimit = DEFAULT_BRUTE_FORCE_LIMIT;
    newOrg.bruteForceAction = DEFAULT_BRUTE_FORCE_ACTION;
    return newOrg;
  }
}