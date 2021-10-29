import { Request, Response, NextFunction } from 'express';
import { __ } from 'i18n';
import { verify } from 'jsonwebtoken';
import { getManager, MoreThanOrEqual } from 'typeorm';

import { Organization, Session } from '../entity';
import { decrypt } from '../utils/kms';

export async function authorize(req: Request, res: Response, next: NextFunction) {
  const entityManager = getManager();
  
  const orgInfo = req.cookies['o'];
  if (!orgInfo) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  const authHeader = req.headers['Authorization'];
  if (!authHeader) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  const token = (authHeader as string).split(' ');
  if (token.length !== 2) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  const org = await entityManager.findOne(Organization, { where: { uniqueId: orgInfo } });
  if (!org) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  let sessionId;
  try {
    sessionId = verify(token[1], await decrypt(org.encryptionKey))?.sessionKey;
  } catch(err) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) }); 
  }

  const session = await entityManager.findOne(Session, { where: { uniqueId: sessionId } });
  if (!session) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  if (session.mfaState === 'unverified') {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });  
  }

  if (session.expiresAt < new Date()) {
    res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  // suspicious activity
  //  - user agent has changed?
  //  - ip has changed?

  next();
}