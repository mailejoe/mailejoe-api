import { Request, Response, NextFunction } from 'express';
import { __ } from 'i18n';
import { verify } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { getManager } from 'typeorm';

import { convertToUTC } from '../utils/datetime';
import { decrypt } from '../utils/kms';

export function rateLimit(limit: number, bucket: string, jailTime: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const entityManager = getManager();

    // expect that auth middleware always goes before rate limit middleware
    

    const org = await entityManager.findOne(Organization, { where: { uniqueId: orgInfo } });
    if (!org) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    let sessionId;
    try {
      const encKey = await decrypt(org.encryptionKey);
      sessionId = verify(token[1], encKey).sessionKey;
    } catch(err) {
      console.error(err);
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) }); 
    }

    const session = await entityManager.findOne(Session, { where: { uniqueId: sessionId } });
    if (!session) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    if (session.mfaState === 'unverified') {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });  
    }

    if (session.expiresAt < new Date()) {
      return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
    }

    session.lastActivityAt = convertToUTC(DateTime.now().toJSDate());
    entityManager.save(session);

    next();
  };
};