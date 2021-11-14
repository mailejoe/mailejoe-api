import { Request, Response, NextFunction } from 'express';
import { __ } from 'i18n';
import { DateTime, Duration } from 'luxon';
import { getManager } from 'typeorm';

import { RateLimit } from '../entity';
import { getIP } from '../utils/ip-info';

export function rateLimit(limit: number, bucket: string, jail: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const entityManager = getManager();

    // expect that auth middleware always goes before rate limit middleware
    const clientIdentifier = getIP(req);
    const bucketTime = Duration.fromISOTime(bucket);
    const jailTime = Duration.fromISOTime(jail);
    const now = DateTime.now();
    const existingRateLimit = req.user
        ? await entityManager.findOne(RateLimit, { where: { userId: req.user.id, route: req.route } })
        : await entityManager.findOne(RateLimit, { where: { clientIdentifier, route: req.route } });
    if (!existingRateLimit) {
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
      const timeTillReset = DateTime.fromJSDate(existingRateLimit.firstCalledOn).plus(jailTime);
      if (existingRateLimit.callCount + 1 === limit) {
        existingRateLimit.firstCalledOn = DateTime.now().toUTC().toJSDate();
        entityManager.save(existingRateLimit);

        res.setHeader(
          'Retry-After',
          jailTime.toMillis(),
        );
        res.status(429).json({ error: 'Too many requests, please try again later.' });
        return;
      } else if (existingRateLimit.callCount === limit && timeTillReset > now) {
        res.setHeader(
          'Retry-After',
          timeTillReset.diff(now, 'milliseconds').toMillis(),
        );
        res.status(429).json({ error: 'Too many requests, please try again later.' });
        return;
      } else if (
        (existingRateLimit.callCount === limit && DateTime.fromJSDate(existingRateLimit.firstCalledOn).plus(jailTime) <= now) ||
        (DateTime.fromJSDate(existingRateLimit.firstCalledOn).plus(bucketTime) < now)
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
}