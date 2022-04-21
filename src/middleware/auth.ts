import { Request, Response, NextFunction } from 'express';
import { __ } from 'i18n';
import { verify } from 'jsonwebtoken';
import { DateTime } from 'luxon';

import MFA_STATES from '../constants/mfa-states';
import { getDataSource } from '../database';
import { Organization, Session, User } from '../entity';
import { convertToUTC } from '../utils/datetime';
import { decrypt } from '../utils/kms';

export function authorize(preMfa?: boolean) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const entityManager = getDataSource().manager;

    const complete = async (session) => {
      session.lastActivityAt = convertToUTC(DateTime.now().toJSDate());
      await entityManager.save(session);

      req.session = session;

      next();
    };
    
    const orgInfo = req.cookies['o'];
    if (!orgInfo) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    const token = (authHeader as string).split(' ');
    if (token.length !== 2) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    const org = await entityManager.findOne(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: orgInfo }
    });
    if (!org) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    let sessionId;
    try {
      const encKey = await decrypt(org.encryptionKey);
      sessionId = verify(token[1], encKey).sessionKey;
    } catch(err) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) }); 
    }

    const session = await entityManager.findOne(Session, {
      where: { uniqueId: sessionId },
      relations: ['organization','user']
    });
    if (!session) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    if (preMfa) {
      const user = await entityManager.findOne(User, {
        where: { id: session.user.id },
        select: {
          id: true,
          mfaSecret: true,
        },
      });
      
      if (session.mfaState === MFA_STATES.UNVERIFIED && user.mfaSecret === null) {
        await complete(session);
        return;
      }
    }

    if (session.mfaState === MFA_STATES.UNVERIFIED) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });  
    }

    if (session.expiresAt < new Date()) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    await complete(session);
  }
} 