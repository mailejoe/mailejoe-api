import { Request, Response, NextFunction } from 'express';
import { __ } from 'i18n';
import { verify } from 'jsonwebtoken';
import { DateTime, Duration } from 'luxon';
import { getManager } from 'typeorm';

import { RateLimit } from '../entity';
import { convertToUTC } from '../utils/datetime';
import { getIP } from '../utils/ip-info';
import { decrypt } from '../utils/kms';

export function rateLimit(limit: number, bucket: string, jailTime: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const entityManager = getManager();

    // expect that auth middleware always goes before rate limit middleware
    const clientIdentifier = getIP(req);
    const bucketTime = Duration.fromISOTime(bucket);
    const now = DateTime.now();
    const rateLimit = req.user
        ? await entityManager.findOne(RateLimit, { where: { userId: req.user.id, route: req.route } })
        : await entityManager.findOne(RateLimit, { where: { clientIdentifier, route: req.route } });
    if (!rateLimit) {
      const newRateLimit = new RateLimit();
      if (req.user) {
        newRateLimit.user = req.user;
      }
      newRateLimit.clientIdentifier = clientIdentifier;
      newRateLimit.route = req.route;
      newRateLimit.callCount = 1;
      newRateLimit.firstCalledOn = DateTime.now().toUTC().toJSDate();
      entityManager.save(newRateLimit);
    } else {
      const existingRateLimit = req.user
        ? await entityManager.findOne(RateLimit, { where: { userId: req.user.id, route: req.route } })
        : await entityManager.findOne(RateLimit, { where: { clientIdentifier, route: req.route } });
      const timeTillReset = DateTime.fromJSDate(rateLimit.firstCalledOn).plus(jailTime);
      if (existingRateLimit.callCount > limit && timeTillReset < now) {
        res.setHeader(
          'Retry-After',
          now.minus(timeTillReset).toMillis(),
        );
        res.status(429).json({ error: 'Too many requests, please try again later.' });
        return;
      } else if (
        (existingRateLimit.callCount > limit && DateTime.fromJSDate(rateLimit.firstCalledOn).plus(jailTime) >= now) ||
        (DateTime.fromJSDate(rateLimit.firstCalledOn).plus(bucketTime) > now)
      ) {
        existingRateLimit.callCount = 1;
        existingRateLimit.firstCalledOn = DateTime.now().toUTC().toJSDate();
        entityManager.save(existingRateLimit);
      } else {
        existingRateLimit.callCount += 1;
        entityManager.save(existingRateLimit);
      }
    }

    next();
  };
};