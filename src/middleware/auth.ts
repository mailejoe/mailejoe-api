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
    return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  const authHeader = req.headers['Authorization'];
  if (!authHeader) {
    return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  const token = (authHeader as string).split(' ');
  if (token.length !== 2) {
    return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  const org = await entityManager.findOne(Organization, { where: { uniqueId: orgInfo } });
  if (!org) {
    return res.status(403).json({ error: __({ phrase: 'errors.unauthorized', locale: req.locale }) });
  }

  let sessionId;
  try {
    sessionId = verify(token[1], await decrypt(org.encryptionKey))?.sessionKey;
  } catch(err) {
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

  // update last activity for session

  next();
}