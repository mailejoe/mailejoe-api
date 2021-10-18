import { Server, Request, ResponseToolkit } from '@hapi/hapi';
import { config } from 'dotenv';
import { __, configure, setLocale } from 'i18n';
import { join, resolve } from 'path';

import {
  establishDatabaseConnection,
  bootstrapServer,
} from './server';
import { isDevelopment, isTest } from './utils/env';
import { getLocale } from './utils/locale';
import { retrieveSecrets } from './utils/secrets';

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/locales'),
  defaultLocale: 'en',
  objectNotation: true,
});

export async function runServer(): Server {
  if (!isDevelopment() && !isTest()) {
    await retrieveSecrets();
  } else {
    config({ path: resolve(__dirname, `../.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV.toLocaleLowerCase()}` : ''}`) });
  }

  const server = await bootstrapServer();
  server.connections = await establishDatabaseConnection();
  server.ext({
    type: 'onRequest',
    method: function (request: Request, h: ResponseToolkit) {
      request.app.locale = getLocale(request);
      request.app.translate = __;
      return h.continue;
    }
  });
  
  console.log(`Server is now running on: ${process.env.HOST}:${process.env.PORT}`);
  return server;
}

export async function stopServer(server: Server): Promise<void> {
  if (server.connections) {
    await server.connections.close();
  }
  await server.stop({ timeout: 300 });
}

if (!isTest()) {
  runServer();
}
