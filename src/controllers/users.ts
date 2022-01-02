import { Request, Response } from 'express';
import { __ } from 'i18n';
import { DateTime } from 'luxon';
import { getManager } from 'typeorm';

import { AuditLog, User } from '../entity';
import { getIPInfo, getIP } from '../utils/ip-info';
import { validate } from '../utils/validate';

export async function fetchUsers(req: Request, res: Response) {
  const entityManager = getManager();
  const { archived, offset, limit, embed } = req.query;

  let users = [],
      total = 0;
  try {
    const error = validate([
      {
        field: 'offset',
        val: offset,
        locale: req.locale,
        validations: [{ type: 'isInt', min: 1, max: Number.MAX_VALUE }]
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
        validations: ['isString', { type: 'isList', values: ['organization','role'] }]
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
      where: { archived: false },
      take: Number(limit) || 100,
      skip: Number(offset) || 0,
    };

    if (archived) {
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
    audit.entityId = req.session.user.id;
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

// export async function fetchUser(req: Request, res: Response) {}
// export async function createUser(req: Request, res: Response) {}
// export async function updateUser(req: Request, res: Response) {}
// export async function deleteUser(req: Request, res: Response) {}
