import { Express, Request, Response } from 'express';
import { setupOrganization, login } from '../controllers/auth';

export const attachRoutes = (app: Express): void => {
  app.get('/ping', (_req: Request, res: Response) => {
    res.send('pong');
  });

  app.post('/setup', setupOrganization);
  app.post('/login', login);
};
