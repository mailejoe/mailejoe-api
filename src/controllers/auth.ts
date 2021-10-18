import { Request, ResponseToolkit } from '@hapi/hapi';
import { badRequest, internal } from '@hapi/boom';
import { randomBytes } from 'crypto';
import { getManager, getRepository } from 'typeorm';

import { Organization, User } from '../entity';
import * as audits from '../utils/audits';

const ORG_UNIQUE_ID_LEN = 32;
const ORG_SESSION_KEY_LEN = 64;
const DEFAULT_MIN_PWD_LEN = 12;
const SPECIAL_CHART_SET = '#$%^&-_*!.?=+';
const DEFAULT_MAX_PWD_AGE = 30; // 30 days
const DEFAULT_SESSION_INTERVAL = '2h';
const DEFAULT_SESSION_KEY_ROTATION = 14; // 14 days
const DEFAULT_BRUTE_FORCE_LIMIT = 5;
const DEFAULT_BRUTE_FORCE_ACTION = 'block';
const USER_VERIFY_TOKEN_LEN = 64;

export async function login(req: Request, h: ResponseToolkit) {
  const { username, password } = req.payload;

  try {
    const sql = await getManager()
      .createQueryBuilder(Organization,'organization')
      //.innerJoin('user.organizationId', 'linkedOrg', 'user.username = :username', { username })
      .where('organization.id = :id', { id: 1 })
      .getOne();
      console.log(sql);
  } catch (err) {
    console.log(err);
  }

  return 'hello';
}

export async function setupOrganization(req: Request, h: ResponseToolkit) {
  const entityManager = getManager();
  const { orgName, email, firstName, lastName } = req.payload;

  try {
    const org = await entityManager.findOne(Organization, { where: { name: orgName } });
    if (org) {
      return badRequest(req.app.translate({ phrase: 'errors.uniqueOrg', locale: req.app.locale }));
    }

    const admin = await entityManager.findOne(User, { where: { email } });
    if (admin) {
      return badRequest(req.app.translate('errors.uniqueEmail'));
    }

    const newOrg = new Organization();
    newOrg.name = orgName;
    newOrg.uniqueId = randomBytes(ORG_UNIQUE_ID_LEN).toString('base64').slice(0, ORG_UNIQUE_ID_LEN);
    newOrg.sessionKey = randomBytes(ORG_SESSION_KEY_LEN).toString('base64').slice(0, ORG_SESSION_KEY_LEN);
    newOrg.sessionKeyLastRotation = new Date(new Date().toISOString()); // always save in UTC time
    newOrg.registeredOn = new Date(new Date().toISOString()); // always save in UTC time
    newOrg.minPwdLen = DEFAULT_MIN_PWD_LEN;
    newOrg.maxPwdLen = null;
    newOrg.minLowercaseChars = 1;
    newOrg.minUppercaseChars = 1;
    newOrg.minNumericChars = 1;
    newOrg.minSpecialChars = 1;
    newOrg.specialCharSet = SPECIAL_CHART_SET;
    newOrg.selfServicePwdReset = false;
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
    await newOrg.save();

    const newAdminUser = new User();
    newAdminUser.organization = newOrg;
    newAdminUser.email = email;
    newAdminUser.firstName = firstName;
    newAdminUser.lastName = lastName;
    newAdminUser.pwdHash = null;
    newAdminUser.mfaSecret = null;
    newAdminUser.mfaEnabled = false;
    newAdminUser.verifyToken = randomBytes(USER_VERIFY_TOKEN_LEN).toString('base64').slice(0, USER_VERIFY_TOKEN_LEN)
    await newAdminUser.save();
  } catch (err) {
    console.log(err);
    return internal('Failed to create new organization');
  }

  return h.code(200);
}