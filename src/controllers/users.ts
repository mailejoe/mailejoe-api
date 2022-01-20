import { Request, Response } from 'express';
import { __ } from 'i18n';
import { DateTime } from 'luxon';
import { getManager } from 'typeorm';

import { AuditLog, User } from '../entity';
import { getIPInfo, getIP } from '../utils/ip-info';
import { validate } from '../utils/validate';

export async function fetchUsers(req: Request, res: Response) {
  const entityManager = getManager();
  const { archived = 'false', offset = '0', limit = '100', embed = '' } = req.query;

  let users = [],
      total = 0;
  try {
    const error = validate([
      {
        field: 'offset',
        val: offset,
        locale: req.locale,
        validations: [{ type: 'isInt', min: 0, max: Number.MAX_VALUE }]
      },
      {
        field: 'limit',
        val: limit,
        locale: req.locale,
        validations: [{ type: 'isInt', min: 1, max: 1000 }]
      },
      {
        field: 'embed',
        val: embed,
        locale: req.locale,
        validations: ['isString', { type: 'isList', values: 'organization,role' }]
      },
      {
        field: 'archived',
        val: archived,
        locale: req.locale,
        validations: [{ type: 'isBoolean', loose: true }]
      },
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    const findClause = {
      where: { organization_id: req.session.user.organization.id, archived: false },
      take: Number(limit) || 100,
      skip: Number(offset) || 0,
    };

    if (req.query.archived) {
      findClause.where.archived = Boolean(archived);
    }

    if (embed) {
      findClause['relations'] = (embed as string).split(',');
    }

    [users, total] = await entityManager.findAndCount(User, findClause);

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = null;
    audit.entityType = 'user';
    audit.operation = 'View';
    audit.info = JSON.stringify({ archived, offset, limit, embed });
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = req.session.user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);
  }
  catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }
  
  return res.status(200).json({ total, data: users });
}

export async function fetchUser(req: Request, res: Response) {
  const entityManager = getManager();
  const { id } = req.params;
  const { embed = '' } = req.query;

  let user = {};
  try {
    const error = validate([
      {
        field: 'id',
        val: id,
        locale: req.locale,
        validations: ['isRequired', { type: 'isInt', min: 1, max: Number.MAX_VALUE }]
      },
      {
        field: 'embed',
        val: embed,
        locale: req.locale,
        validations: ['isString', { type: 'isList', values: ['organization','role'] }]
      },
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    const findClause = {
      where: {
        id: Number(id),
        organization_id: req.session.user.organization.id,
        archived: false
      },
    };

    if (embed) {
      findClause['relations'] = (embed as string).split(',');
    }

    user = await entityManager.findOne(User, findClause);

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = Number(id);
    audit.entityType = 'user';
    audit.operation = 'View';
    audit.info = JSON.stringify({ id, embed });
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = req.session.user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);
  }
  catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }
  
  if (!user) {
    return res.status(404);
  }
  return res.status(200).json({ user });
}

export async function createUser(req: Request, res: Response) {
  const entityManager = getManager();
  const { firstName, lastName, email, role } = req.body;

  let mfaEnabled = true, user: User;
  try {
    const error = validate([
      {
        field: 'firstName',
        val: firstName,
        locale: req.locale,
        validations: ['isRequired']
      },
      {
        field: 'lastName',
        val: lastName,
        locale: req.locale,
        validations: ['isRequired']
      },
      {
        field: 'email',
        val: email,
        locale: req.locale,
        validations: ['isRequired', 'isEmail']
      },
      {
        field: 'role',
        val: role,
        locale: req.locale,
        validations: ['isRequired', 'isNumber']
      },
      {
        field: 'role',
        val: `${role}`,
        locale: req.locale,
        validations: [{ type: 'isInt', min: 1, max: Number.MAX_VALUE }]
      },
      {
        field: 'mfaEnabled',
        val: mfaEnabled,
        locale: req.locale,
        validations: [{ type: 'isBoolOptional' }]
      },
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    if (req.session.user.organization.enforceMfa) {
      mfaEnabled = true; 
    } else if (req.body.mfaEnabled !== undefined) {
      mfaEnabled = Boolean(req.body.mfaEnabled);
    }

    user = await entityManager.create(User, {
      ...req.body,
      organization: req.session.user.organization,
      mfaEnabled
    });

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = user.id;
    audit.entityType = 'user';
    audit.operation = 'Create';
    audit.info = JSON.stringify(req.body);
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = req.session.user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);
  }
  catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }
  
  return res.status(200).json(user);
}

export async function updateUser(req: Request, res: Response) {
  const entityManager = getManager();
  const { firstName, lastName, email, role } = req.body;

  let mfaEnabled = true, user: User;
  try {
    const error = validate([
      {
        field: 'firstName',
        val: firstName,
        locale: req.locale,
        validations: ['isString']
      },
      {
        field: 'lastName',
        val: lastName,
        locale: req.locale,
        validations: ['isRequired']
      },
      {
        field: 'email',
        val: email,
        locale: req.locale,
        validations: ['isRequired', 'isEmail']
      },
      {
        field: 'role',
        val: role,
        locale: req.locale,
        validations: ['isRequired', { type: 'isIntBody', min: 1, max: Number.MAX_VALUE }]
      },
      {
        field: 'mfaEnabled',
        val: mfaEnabled,
        locale: req.locale,
        validations: [{ type: 'isBoolOptional' }]
      },
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    if (req.session.user.organization.enforceMfa) {
      mfaEnabled = true; 
    } else if (req.body.mfaEnabled !== undefined) {
      mfaEnabled = Boolean(req.body.mfaEnabled);
    }

    user = await entityManager.create(User, {
      ...req.body,
      organization: req.session.user.organization,
      mfaEnabled
    });

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = user.id;
    audit.entityType = 'user';
    audit.operation = 'Create';
    audit.info = JSON.stringify(req.body);
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = req.session.user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);
  }
  catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }
  
  return res.status(200).json(user);
}

// export async function deleteUser(req: Request, res: Response) {}
