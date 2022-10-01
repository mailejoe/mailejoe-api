import { Express, Router, Request, Response } from 'express';
import {
  setupOrganization, login, mfa,
  passwordResetRequest, passwordReset,
  setupMfa, confirmMfa,
} from '../controllers/auth';
import {
  fetchUsers, fetchUser, createUser,
  updateUser, deleteUser
} from '../controllers/users';
import {
  fetchRoles, fetchRole, createRole,
  updateRole, deleteRole
} from '../controllers/roles';
import { authorize } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

export const attachRoutes = (app: Express): void => {
  app.get('/ping', (_req: Request, res: Response) => {
    res.send('pong').end();
  });

  const apiRouter = Router();

  apiRouter.post('/setup', rateLimit(10, '00:15', '01:00'), setupOrganization);
  
  apiRouter.post('/login', rateLimit(10, '01:00', '01:00'), login);
  apiRouter.post('/mfa', rateLimit(10, '01:00', '01:00'), authorize({ mfaEndpoint: true }), mfa);
  apiRouter.post('/forgot-password', rateLimit(10, '01:00', '01:00'), passwordResetRequest);
  apiRouter.post('/password-reset', rateLimit(10, '01:00', '01:00'), passwordReset);
  apiRouter.post('/setup-mfa', rateLimit(10, '01:00', '01:00'), authorize({ preMfa: true }), setupMfa);
  apiRouter.post('/confirm-mfa', rateLimit(10, '01:00', '01:00'), authorize({ preMfa: true }), confirmMfa);
  
  apiRouter.get('/users', rateLimit(100, '00:01', '00:05'), authorize(), fetchUsers);
  apiRouter.get('/users/:id', rateLimit(100, '00:01', '00:05'), authorize(), fetchUser);
  apiRouter.post('/users', rateLimit(100, '00:01', '00:05'), authorize(), createUser);
  apiRouter.put('/users/:id', rateLimit(100, '00:01', '00:05'), authorize(), updateUser);
  apiRouter.delete('/users/:id', rateLimit(100, '00:01', '00:05'), authorize(), deleteUser);

  apiRouter.get('/roles', rateLimit(100, '00:01', '00:05'), authorize(), fetchRoles);
  apiRouter.get('/roles/:id', rateLimit(100, '00:01', '00:05'), authorize(), fetchRole);
  apiRouter.post('/roles', rateLimit(100, '00:01', '00:05'), authorize(), createRole);
  apiRouter.put('/roles/:id', rateLimit(100, '00:01', '00:05'), authorize(), updateRole);
  apiRouter.delete('/roles/:id', rateLimit(100, '00:01', '00:05'), authorize(), deleteRole);

  apiRouter.get('/auth/current-account', (_, res) => { res.sendStatus(403) });

  app.use('/api/v1', apiRouter);
};
