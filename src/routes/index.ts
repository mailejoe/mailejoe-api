import { Request, ResponseToolkit, Server } from '@hapi/hapi';
import { accountLookup } from '../controllers/auth';

export const attachRoutes = (server: Server): void => {
  server.route({
    method: 'GET',
    path: '/ping',
    handler: (_req: Request, _h: ResponseToolkit): string => {
      return 'ping';
    },
  });

  server.route({
    method: 'GET',
    path: '/other',
    handler: accountLookup,
  });
};
