import { Request, ResponseToolkit, Server } from '@hapi/hapi';
import * as Joi from '@hapi/joi';
import { login, setupOrganization } from '../controllers/auth';

export const attachRoutes = (server: Server): void => {
  server.route({
    method: 'GET',
    path: '/ping',
    handler: (_req: Request, _h: ResponseToolkit): string => {
      return 'ping';
    },
  });

  server.route({
    method: 'POST',
    path: '/login',
    handler: login,
  });

  server.route({
    method: 'POST',
    path: '/setup',
    handler: setupOrganization,
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          orgName: Joi.string().min(1).max(255),
          firstName: Joi.string().min(1).max(255),
          lastName: Joi.string().min(1).max(255),
          email: Joi.string().min(1).max(1024).email({ minDomainSegments: 2 }),
        })
      }
    }
  })
};
