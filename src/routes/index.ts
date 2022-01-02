import { Express, Router, Request, Response } from 'express';
import { setupOrganization, login, mfa, passwordResetRequest, passwordReset } from '../controllers/auth';
import { fetchUsers } from '../controllers/users';
import { authorize } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

export const attachRoutes = (app: Express): void => {
  app.get('/ping', (_req: Request, res: Response) => {
    res.send('pong');
  });

  const router = Router();
  router.use(rateLimit(1, '00:15', '01:00'));
  router.post('/setup', setupOrganization);
  router.use(rateLimit(10, '01:00', '01:00'));
  router.post('/login', login);
  router.post('/mfa', mfa);
  router.post('/forgot-password', passwordResetRequest);
  router.post('/password-reset', passwordReset);

  router.use(authorize);
  router.use(rateLimit(100, '00:01', '00:05'));
  router.get('/users', fetchUsers);

  app.use('/api/v1', router);
};
