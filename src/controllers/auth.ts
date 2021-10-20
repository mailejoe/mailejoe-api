import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { getManager } from 'typeorm';
import { __ } from 'i18n';

import { Organization, User } from '../entity';
import * as audits from '../utils/audits';
import { validate } from '../utils/validate';

const USER_VERIFY_TOKEN_LEN = 64;

export async function setupOrganization(req: Request, res: Response) {
  const entityManager = getManager();
  const { orgName, email, firstName, lastName } = req.body;

  try {
    const error = validate([
      {
        field: 'orgName',
        val: orgName,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 10 }]
      },
      {
        field: 'firstName',
        val: firstName,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 10 }]
      },
      {
        field: 'lastName',
        val: lastName,
        locale: req.locale,
        validations: ['isRequired', 'isString', { type: 'isLength', min: 1, max: 10 }]
      },
      {
        field: 'email',
        val: email,
        locale: req.locale,
        validations: ['isRequired', 'isString', 'isEmail']
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
    return res.status(500).json('Failed to create new organization');
  }

  return res.status(200);
}

export async function login(req: Request, res: Response) {
  const entityManager = getManager();
  const { email, password } = req.body;

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
        validations: ['isRequired', 'isString']
      }
    ]);

    if (error) {
      return res.status(400).json(error);
    }

    const user = await entityManager.findOne(User, { where: { email } });
    if (!user) {
      return res.status(400).json('errors.emailDoesNotExist');
    }

    // compare the passwords

    // add session

    // add user access history

    // add audit log entry

    // return JWT with session guid
  } catch (err) {
    console.log(err);
    return res.status(500).json('Failed to create new organization');
  }
}