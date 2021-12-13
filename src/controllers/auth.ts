import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { Request, Response } from 'express';
import { sign } from 'jsonwebtoken';
import { __ } from 'i18n';
import { DateTime, Duration } from 'luxon';
import { totp } from 'speakeasy';
import { getManager, MoreThan, LessThanOrEqual } from 'typeorm';

import { permissions } from '../constants';
import { AuditLog, Organization, Permission, Role, Session, User, UserAccessHistory, UserPwdHistory } from '../entity';
import { isDevelopment, isTest } from '../utils/env';
import { sendEmail } from '../utils/ses';
import { getIPInfo, getIP } from '../utils/ip-info';
import {
  decrypt,
  decryptWithDataKey,
  generateEncryptionKey
} from '../utils/kms';
import { validate } from '../utils/validate';

const UNIQUE_SESSION_ID_LEN = 64;
const SALT_ROUNDS = 10;

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
    newOrg.encryptionKey = await generateEncryptionKey();
    await entityManager.save(newOrg);

    const newAdminRole = Role.defaultAdminRole(__, req.locale);
    newAdminRole.organization = newOrg;
    await entityManager.save(newAdminRole);

    permissions.forEach(async (permission) => {
      const rolePermission = new Permission();
      rolePermission.role = newAdminRole;
      rolePermission.permission = permission.name;
      await entityManager.save(rolePermission);
    });
    
    const newAdminUser = User.defaultNewUser({ org: newOrg, email, firstName, lastName });
    newAdminUser.role = newAdminRole;
    await entityManager.save(newAdminUser);

    const inviteHtmlTmpl = readFileSync('./templates/invite.html')
      .toString('utf8')
      .replace(/\[USER\]/g, `${firstName} ${lastName}`)
      .replace(/\[TOKEN\]/g, encodeURIComponent(newAdminUser.resetToken));
    const inviteTxtTmpl = readFileSync('./templates/invite.txt')
      .toString('utf8')
      .replace(/\[USER\]/g, `${firstName} ${lastName}`)
      .replace(/\[TOKEN\]/g, encodeURIComponent(newAdminUser.resetToken));

    await sendEmail({ subject: 'Welcome to Mailejoe!', email, html: inviteHtmlTmpl, txt: inviteTxtTmpl });  
  } catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.setupFailed', locale: req.locale }) });
  }

  return res.status(200).json({});
}

export async function login(req: Request, res: Response) {
  const entityManager = getManager();
  const { email, password } = req.body;

  let token,
      mfaEnabled;
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

    const ip = getIP(req);

    mfaEnabled = Boolean(user.mfaEnabled);

    const userAgent = req.get('User-Agent');

    // add session
    const session = new Session();
    session.organization = user.organization;
    session.user = user;
    session.uniqueId = randomBytes(UNIQUE_SESSION_ID_LEN).toString('base64');
    session.mfaState = user.mfaEnabled ? 'unverified' : 'verified';
    session.createdAt = DateTime.now().toUTC().toJSDate();
    session.lastActivityAt = DateTime.now().toUTC().toJSDate();
    session.expiresAt = DateTime.now().plus(Duration.fromISOTime(user.organization.sessionInterval)).toUTC().toJSDate();
    session.userAgent = userAgent;
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
      userAccessHistory.userAgent = userAgent;
      userAccessHistory.localization = req.locale;
      userAccessHistory.region = ipinfo.region;
      userAccessHistory.city = ipinfo.city;
      userAccessHistory.countryCode = ipinfo.country;
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
    audit.operation = 'Login';
    audit.info = JSON.stringify({ email });
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);

    const maxAge = Duration.fromISOTime(user.organization.sessionInterval).toMillis();

    res.cookie('o', user.organization.uniqueId, {
      maxAge,
      httpOnly: true,
      sameSite: 'lax',
      secure: isDevelopment() || isTest() ? false : true,
    });

    // return JWT with session guid
    token = sign({ sessionKey: session.uniqueId }, await decrypt(user.organization.encryptionKey), {
      expiresIn: maxAge / 1000,
      issuer: 'mailejoe',
    });
  } catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }

  return res.status(200).json({ token, mfaEnabled });
}

export async function mfa(req: Request, res: Response) {
  const entityManager = getManager();
  const { token } = req.body;

  try {
    const error = validate([
      {
        field: 'token',
        val: token,
        locale: req.locale,
        validations: ['isRequired','isString']
      }
    ]);

    if (error) {
      return res.status(400).json({ error });
    }
    
    if (!req.session?.user) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }
    
    if (!req.session?.user.mfaSecret) {
      return res.status(403).json({ mfaSetup: true });
    }

    const encryptionKey = await decrypt(req.session.user.organization.encryptionKey);
    const mfaSecret = decryptWithDataKey(encryptionKey, req.session.user.mfaSecret);
    const verified = totp.verify({
      secret: mfaSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      return res.status(403).json({ error: __({ phrase: 'errors.invalidToken', locale: req.locale }) });
    }

    // add user access history
    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const userAgent = req.get('User-Agent');

    const userAccessHistory = new UserAccessHistory();
    userAccessHistory.organization = req.session.user.organization;
    userAccessHistory.user = req.session.user;
    userAccessHistory.session = req.session;
    userAccessHistory.programmatic = false;
    userAccessHistory.ip = ip;
    userAccessHistory.userAgent = userAgent;
    userAccessHistory.localization = req.locale;
    userAccessHistory.region = ipinfo.region;
    userAccessHistory.city = ipinfo.city;
    userAccessHistory.countryCode = ipinfo.country;
    userAccessHistory.latitude = ipinfo.latitude;
    userAccessHistory.longitude = ipinfo.longitude;
    userAccessHistory.login = DateTime.now().toUTC().toJSDate();
    await entityManager.save(userAccessHistory);

    req.session.mfaState = 'verified';
    req.session.lastActivityAt = DateTime.now().toUTC().toJSDate();
    await entityManager.save(req.session);

    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = req.session.user.id;
    audit.entityType = 'user';
    audit.operation = 'Mfa';
    audit.info = JSON.stringify({});
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = req.session.user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);
  } catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }

  return res.status(200).json({});
}

export async function passwordResetRequest(req: Request, res: Response) {
  const entityManager = getManager();
  const { email } = req.body;

  try {
    const error = validate([
      {
        field: 'email',
        val: email,
        locale: req.locale,
        validations: ['isRequired','isString','isEmail']
      }
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    const user = await entityManager.findOne(User, { where: { email } });
    if (!user) {
      return res.status(200).json({ message: __({ phrase: 'responses.passwordResetEmail', locale: req.locale }) });
    }

    if (!user.organization.selfServicePwdReset) {
      return res.status(200).json({ message: __({ phrase: 'responses.passwordResetEmail', locale: req.locale }) });
    }

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = user.organization;
    audit.entityId = user.id;
    audit.entityType = 'user';
    audit.operation = 'PasswordResetRequest';
    audit.info = JSON.stringify({});
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);

    user.resetToken = User.createNewResetToken();
    user.tokenExpiration = DateTime.now().plus({ days: 3 }).toUTC().toJSDate();
    await entityManager.save(user);

    const forgotPasswordHtmlTmpl = readFileSync('./templates/forgot-password.html')
      .toString('utf8')
      .replace('[USER]', `${user.firstName} ${user.lastName}`)
      .replace('[TOKEN]', encodeURIComponent(user.resetToken))
    const forgotPasswordTxtTmpl = readFileSync('./templates/forgot-password.txt')
      .toString('utf8')
      .replace('[USER]', `${user.firstName} ${user.lastName}`)
      .replace('[TOKEN]', encodeURIComponent(user.resetToken));

    await sendEmail({ subject: 'Mailejoe Password Reset', email, html: forgotPasswordHtmlTmpl, txt: forgotPasswordTxtTmpl });  
  } catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }

  return res.status(200).json({ message: __({ phrase: 'responses.passwordResetEmail', locale: req.locale }) });
}

export async function passwordReset(req: Request, res: Response) {
  const entityManager = getManager();
  const { password } = req.body;
  const token: string = req.query.token as string

  try {
    const error = validate([
      {
        field: 'password',
        val: password,
        locale: req.locale,
        validations: ['isRequired','isString']
      }
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    if (!token) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    const user = await entityManager.findOne(User, {
      where: { resetToken: token },
      relations: ['organization'],
    });
    if (!user) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    if (user.tokenExpiration < new Date()) {
      return res.status(403).json({ error: __({ phrase: 'errors.tokenExpired', locale: req.locale }) });
    }

    if (!user.organization.selfServicePwdReset) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    // is the password valid
    const orgInfo = user.organization;
    const passwordError = validate([
      {
        field: 'password',
        val: password,
        locale: req.locale,
        validations: [
          {
            type: 'isLength',
            min: orgInfo.minPwdLen || 1,
            max: orgInfo.maxPwdLen || 255,
          },
          ...orgInfo.minLowercaseChars ? [{
            type: 'matches',
            msg: 'isMinLowercase',
            pattern: `(?=(.*[a-z]){${orgInfo.minLowercaseChars}})`,
            min: orgInfo.minLowercaseChars,
          }] : [],
          ...orgInfo.minUppercaseChars ? [{
            type: 'matches',
            msg: 'isMinUppercase',
            pattern: `(?=(.*[A-Z]){${orgInfo.minUppercaseChars}})`,
            min: orgInfo.minUppercaseChars,
          }] : [],
          ...orgInfo.minNumericChars ? [{
            type: 'matches',
            msg: 'isMinNumeric',
            pattern: `(?=(.*[0-9]){${orgInfo.minNumericChars}})`,
            min: orgInfo.minNumericChars,
          }] : [],
          ...orgInfo.minSpecialChars ? [{
            type: 'matches',
            msg: 'isMinSpecial',
            pattern: `(?=(.*[${orgInfo.specialCharSet}]){${orgInfo.minSpecialChars}})`,
            min: orgInfo.minSpecialChars,
            charset: orgInfo.specialCharSet,
          }] : [],
        ]
      }
    ]);

    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const newPwdhash = await hash(password, SALT_ROUNDS);

    if (user.organization.pwdReused !== null) {
      const oldPwds = await entityManager.find(UserPwdHistory,
        {
          select: ['pwd'],
          where: { user },
          order: {
            lastUsedOn: 'DESC',
          },
          take: user.organization.pwdReused,
        }
      );

      const reusedPwd = oldPwds.find(d => d.pwd === newPwdhash);
      if (reusedPwd) {
        return res.status(400).json({ error: __({ phrase: 'errors.passwordReuse', locale: req.locale }) });
      }
    }

    if (user.pwdHash) {
      const oldPwdHash = user.pwdHash;
      const userPwdHistory = new UserPwdHistory();
      userPwdHistory.organization = user.organization;
      userPwdHistory.user = user;
      userPwdHistory.pwd = oldPwdHash;
      userPwdHistory.lastUsedOn = DateTime.now().toUTC().toJSDate();
      await entityManager.save(userPwdHistory);
    }

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = user.organization;
    audit.entityId = user.id;
    audit.entityType = 'user';
    audit.operation = 'PasswordReset';
    audit.info = JSON.stringify({});
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);

    await entityManager.update(User, { id: user.id }, { pwdHash: newPwdhash, resetToken: null, tokenExpiration: null });

    const now = DateTime.now().toUTC().toJSDate();
    await entityManager.update(Session,
      { user: user, expiresAt: MoreThan(now) },
      { expiresAt: now }
    );

    const passwordResetHtmlTmpl = readFileSync('./templates/password-change.html')
      .toString('utf8')
      .replace(/\[USER\]/g, `${user.firstName} ${user.lastName}`);
    const passwordResetTxtTmpl = readFileSync('./templates/password-change.txt')
      .toString('utf8')
      .replace(/\[USER\]/g, `${user.firstName} ${user.lastName}`);

    await sendEmail({ subject: 'Mailejoe Password Update', email: user.email, html: passwordResetHtmlTmpl, txt: passwordResetTxtTmpl });  
  } catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }

  return res.status(200).json({ message: __({ phrase: 'responses.passwordReset', locale: req.locale }) });
}
