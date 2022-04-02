import { Request, Response, NextFunction } from 'express';
import { __ } from 'i18n';
import { DateTime, Duration } from 'luxon';

import { getDataSource } from '../database';
import { RateLimit } from '../entity';
import { getIP } from '../utils/ip-info';

export function rateLimit(limit: number, bucket: string, jail: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const entityManager = getDataSource().manager;

    // expect that auth middleware always goes before rate limit middleware
    const clientIdentifier = getIP(req);
    const bucketTime = Duration.fromISOTime(bucket);
    const jailTime = Duration.fromISOTime(jail);
    const now = DateTime.now();
    const existingRateLimit = req.session
        ? await entityManager.findOne(RateLimit, { where: { user: req.session.user, route: req.url } })
        : await entityManager.findOne(RateLimit, { where: { clientIdentifier, route: req.url } });
    if (!existingRateLimit) {
      const newRateLimit = new RateLimit();
      if (req.session) {
        newRateLimit.user = req.session.user;
      } else {
        newRateLimit.user = null;
      }
      newRateLimit.clientIdentifier = clientIdentifier;
      newRateLimit.route = req.url;
      newRateLimit.callCount = 1;
      newRateLimit.firstCalledOn = DateTime.now().toUTC().toJSDate();
      await entityManager.save(newRateLimit);
    } else {
      const timeTillReset = DateTime.fromJSDate(existingRateLimit.firstCalledOn).plus(jailTime);
      if (existingRateLimit.callCount + 1 === limit) {
        existingRateLimit.firstCalledOn = DateTime.now().toUTC().toJSDate();
        await entityManager.save(existingRateLimit);

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
        await entityManager.save(existingRateLimit);
      } else {
        existingRateLimit.callCount += 1;
        await entityManager.save(existingRateLimit);
      }
    }

    next();
  };
}