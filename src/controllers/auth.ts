import { compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { sign } from 'jsonwebtoken';
import { __ } from 'i18n';
import { DateTime, Duration } from 'luxon';
import { getManager, LessThanOrEqual } from 'typeorm';

import { AuditLog, Organization, Session, User, UserAccessHistory } from '../entity';
import { getIPInfo } from '../utils/ip-info';
import { decrypt, encrypt } from '../utils/kms';
import { validate } from '../utils/validate';

const UNIQUE_SESSION_ID_LEN = 64;

export async function setupOrganization(req: Request, res: Response) {
  const entityManager = getManager();
  const { orgName, email, firstName, lastName } = req.body;

  try {
    const error = validate([
      {
        field: 'orgName',
        val: orgName,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 255 }]
      },
      {
        field: 'firstName',
        val: firstName,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 255 }]
      },
      {
        field: 'lastName',
        val: lastName,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 255 }]
      },
      {
        field: 'email',
        val: email,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 1024 }, 'isEmail']
      }
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    const org = await entityManager.findOne(Organization, { where: { name: orgName } });
    if (org) {
      return res.status(400).json({ error: __({ phrase: 'errors.uniqueOrg', locale: req.locale }) });
    }

    const admin = await entityManager.findOne(User, { where: { email } });
    if (admin) {
      return res.status(400).json({ error: __({ phrase: 'errors.uniqueEmail', locale: req.locale }) });
    }

    const newOrg = Organization.defaultNewOrganization(orgName);
    newOrg.sessionKey = await encrypt(newOrg.sessionKey);
    await entityManager.save(newOrg);
    
    const newAdminUser = User.defaultNewUser({ org: newOrg, email, firstName, lastName });
    await entityManager.save(newAdminUser);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: __({ phrase: 'errors.setupFailed', locale: req.locale }) });
  }

  return res.status(200).json({});
}

export async function login(req: Request, res: Response) {
  const entityManager = getManager();
  const { email, password } = req.body;

  let token;
  try {
    const error = validate([
      {
        field: 'email',
        val: email,
        locale: req.locale,
        validations: ['isRequired', 'isString', 'isEmail']
      },
      {
        field: 'password',
        val: password,
        locale: req.locale,
        validations: ['isRequired']
      }
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    const user = await entityManager.findOne(User, { where: { email } });
    if (!user) {
      return res.status(403).json({ error: __({ phrase: 'errors.invalidLogin', locale: req.locale }) });
    }

    if (!user.pwdHash) {
      return res.status(403).json({ error: __({ phrase: 'errors.passwordResetRequired', locale: req.locale }) });
    }

    const hashResult = await compare(password, user.pwdHash);
    if (!hashResult) {
      return res.status(403).json({ error: __({ phrase: 'errors.invalidLogin', locale: req.locale }) });
    }

    const existingSessions = await entityManager.find(Session, {
      where: {
        user: { id: user.id },
        expiresAt: LessThanOrEqual(DateTime.now().toUTC().toJSDate()),
      },
      relations: ['user'],
    });

    if (!user.organization.allowMultipleSessions && existingSessions?.length > 0) {
      return res.status(403).json({ error: __({ phrase: 'errors.userHasExistingSession', locale: req.locale }) });
    }

    let ip = '';
    if (req.headers['x-forwarded-for']) {
      ip = (req.headers['x-forwarded-for'] as string);
    } else {
      ip = req.socket.remoteAddress || '';
    }

    // add session
    const session = new Session();
    session.organization = user.organization;
    session.user = user;
    session.uniqueId = randomBytes(UNIQUE_SESSION_ID_LEN).toString('base64').slice(0, UNIQUE_SESSION_ID_LEN);
    session.mfaState = user.mfaEnabled ? 'unverified' : 'verified';
    session.createdAt = DateTime.now().toUTC().toJSDate();
    session.lastActivityAt = DateTime.now().toUTC().toJSDate();
    session.expiresAt = DateTime.now().plus(Duration.fromISOTime(user.organization.sessionInterval)).toUTC().toJSDate();
    session.userAgent = req.get('User-Agent');
    session.ip = ip;
    await entityManager.save(session);

    // add user access history
    const ipinfo = await getIPInfo(ip);

    if (!user.mfaEnabled) {
      const userAccessHistory = new UserAccessHistory();
      userAccessHistory.organization = user.organization;
      userAccessHistory.user = user;
      userAccessHistory.session = session;
      userAccessHistory.programmatic = false;
      userAccessHistory.ip = ip;
      userAccessHistory.userAgent = req.get('User-Agent');
      userAccessHistory.localization = req.locale;
      userAccessHistory.region = ipinfo.region;
      userAccessHistory.city = ipinfo.city;
      userAccessHistory.coutryCode = ipinfo.country;
      userAccessHistory.latitude = ipinfo.latitude;
      userAccessHistory.longitude = ipinfo.longitude;
      userAccessHistory.login = DateTime.now().toUTC().toJSDate();
      await entityManager.save(userAccessHistory);
    }

    // add audit log entry
    const audit = new AuditLog();
    audit.organization = user.organization;
    audit.entityId = user.id;
    audit.entityType = 'user';
    audit.operation = 'login';
    audit.info = JSON.stringify({ email });
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);

    // return JWT with session guid
    token = sign({ sessionKey: session.uniqueId }, await decrypt(user.organization.sessionKey), {
      expiresIn: Duration.fromISOTime(user.organization.sessionInterval).toMillis() / 1000,
      issuer: 'mailejoe',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
    }

  return res.status(200).json({ token });
}