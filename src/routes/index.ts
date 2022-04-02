import { Express, Router, Request, Response } from 'express';
import {
  setupOrganization, login, mfa,
  passwordResetRequest, passwordReset
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

  const router = Router();
  router.use(rateLimit(10, '00:15', '01:00'));
  router.post('/setup', setupOrganization);
  router.use(rateLimit(10, '01:00', '01:00'));
  router.post('/login', login);
  router.post('/mfa', mfa);
  router.post('/forgot-password', passwordResetRequest);
  router.post('/password-reset', passwordReset);

  router.use(authorize);
  router.use(rateLimit(100, '00:01', '00:05'));
  router.get('/users', fetchUsers);
  router.get('/users/:id', fetchUser);
  router.post('/users', createUser);
  router.put('/users/:id', updateUser);
  router.delete('/users/:id', deleteUser);

  router.get('/roles', fetchRoles);
  router.get('/roles/:id', fetchRole);
  router.post('/roles', createRole);
  router.put('/roles/:id', updateRole);
  router.delete('/roles/:id', deleteRole);

  app.use('/api/v1', router);
};
