import { Express, Router, Request, Response } from 'express';
import { setupOrganization, login, mfa, passwordResetRequest, passwordReset } from '../controllers/auth';

export const attachRoutes = (app: Express): void => {
  app.get('/ping', (_req: Request, res: Response) => {
    res.send('pong');
  });

  const router = Router();
  router.post('/setup', setupOrganization);
  router.post('/login', login);
  router.post('/mfa', mfa);
  router.post('/forgot-password', passwordResetRequest);
  router.post('/password-reset', passwordReset);
  app.use('/api/v1', router);
};
