import { Request, Response } from 'express';
import { __ } from 'i18n';
import { DateTime } from 'luxon';
import { getManager } from 'typeorm';

import { permissions as permissionList } from '../constants/permissions';
import { AuditLog, Permission, Role, User } from '../entity';
import { getIPInfo, getIP } from '../utils/ip-info';
import { validate } from '../utils/validate';

export async function fetchRoles(req: Request, res: Response) {
  const entityManager = getManager();
  const { archived = 'false', offset = '0', limit = '100', embed = '' } = req.query;

  let roles = [],
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
        validations: ['isString', { type: 'isList', values: ['permission'] }]
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

    [roles, total] = await entityManager.findAndCount(Role, findClause);

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = null;
    audit.entityType = 'role';
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
  
  return res.status(200).json({ total, data: roles });
}

export async function fetchRole(req: Request, res: Response) {
  const entityManager = getManager();
  const { id } = req.params;
  const { embed = '' } = req.query;

  let role = {};
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
        validations: ['isString', { type: 'isList', values: ['permission'] }]
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

    role = await entityManager.findOne(Role, findClause);

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = Number(id);
    audit.entityType = 'role';
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
  
  if (!role) {
    return res.status(404).end();
  }
  return res.status(200).json({ role });
}

export async function createRole(req: Request, res: Response) {
  const entityManager = getManager();
  const { name, description = null, permissions } = req.body;

  let role: Role;
  try {
    const error = validate([
      {
        field: 'name',
        val: name,
        locale: req.locale,
        validations: ['isRequired', 'isString']
      },
      {
        field: 'description',
        val: description,
        locale: req.locale,
        validations: [{ type: 'is', dataType: 'string', optional: true }]
      },
      {
        field: 'permissions',
        val: permissions,
        locale: req.locale,
        validations: ['isRequired', { type: 'is', dataType: 'array' }]
      },
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    permissions.forEach((permission) => {
      if (!permissionList.find((item) => item.name === permission)) {
        return res.status(400).json({ error: __({ phrase: 'errors.invalidPermission', locale: req.locale }, permission) });
      }
    });

    role = await entityManager.create(Role, {
      name,
      description,
      organization: req.session.user.organization,
    });

    await entityManager.createQueryBuilder()
      .insert()
      .into(Permission)
      .values(permissions.map((permission) => ({
        role,
        permission,
      })))
      .execute();

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = role.id;
    audit.entityType = 'role';
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
  
  return res.status(200).json(role);
}

export async function updateRole(req: Request, res: Response) {
  const entityManager = getManager();
  const { id } = req.params;
  const { permissions, ...other } = req.body;

  const paramError = validate([
    {
      field: 'id',
      val: id,
      locale: req.locale,
      validations: ['isRequired', 'isNumeric']
    }
  ]);

  if (paramError) {
    return res.status(400).json({ error: paramError });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: __({ phrase: 'errors.emptyPayload', locale: req.locale }) });
  }

  let role: Role;
  try {
    const error = validate([
      {
        field: 'name',
        val: other.name,
        locale: req.locale,
        validations: [{ type: 'is', dataType: 'string', optional: true }]
      },
      {
        field: 'description',
        val: other.description,
        locale: req.locale,
        validations: [{ type: 'is', dataType: 'string', optional: true }]
      },
      {
        field: 'permissions',
        val: permissions,
        locale: req.locale,
        validations: [{ type: 'is', dataType: 'array', optional: true }]
      },
    ]);

    if (error) {
      return res.status(400).json({ error });
    }

    (permissions || []).forEach((permission) => {
      if (!permissionList.find((item) => item.name === permission)) {
        return res.status(400).json({ error: __({ phrase: 'errors.invalidPermission', locale: req.locale }, permission) });
      }
    });

    const existingRole = await entityManager.findOne(Role, { id: +id, archived: false });
    if (!existingRole) {
      return res.status(404).end();
    }

    await entityManager.update(Role, {
      ...other,
    }, { id: +req.params.id });

    if (permissions) {
      await entityManager.delete(Permission, { role: existingRole });
      await entityManager.createQueryBuilder()
        .insert()
        .into(Permission)
        .values(permissions.map((permission) => ({
          role: existingRole,
          permission,
        })))
        .execute();
    }

    role = await entityManager.findOne(Role, {
      id: +req.params.id
    });

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = +req.params.id;
    audit.entityType = 'role';
    audit.operation = 'Update';
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
  
  return res.status(200).json(role);
}

export async function deleteRole(req: Request, res: Response) {
  const entityManager = getManager();
  const { id } = req.params;

  const paramError = validate([
    {
      field: 'id',
      val: id,
      locale: req.locale,
      validations: ['isRequired', 'isNumeric']
    }
  ]);

  if (paramError) {
    return res.status(400).json({ error: paramError });
  }

  try {
    const role = await entityManager.findOne(Role, { id: +id, archived: false });
    if (!role) {
      return res.status(404).end();
    }

    const usersWithRole = await entityManager.find(User, { role });
    if (usersWithRole.length > 0) {
      return res.status(400).json({ error: __({ phrase: 'errors.roleStillHasUsers', locale: req.locale }) });
    }

    await entityManager.update(Role, { archived: true }, { id: +req.params.id });

    const ip = getIP(req);
    const ipinfo = await getIPInfo(ip);
    const audit = new AuditLog();
    audit.organization = req.session.user.organization;
    audit.entityId = +req.params.id;
    audit.entityType = 'role';
    audit.operation = 'Delete';
    audit.info = JSON.stringify({});
    audit.generatedOn = DateTime.now().toUTC().toJSDate();
    audit.generatedBy = req.session.user.id;
    audit.ip = ip;
    audit.countryCode = ipinfo.country;
    await entityManager.save(audit);
  } catch (err) {
    return res.status(500).json({ error: __({ phrase: 'errors.internalServerError', locale: req.locale }) });
  }
  
  return res.status(204).end();
}