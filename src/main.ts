import { Server } from '@hapi/hapi';
import { isDevelopment, isTest } from './utils/env';
import {
  establishDatabaseConnection,
  bootstrapServer,
} from './server';
import { retrieveSecrets } from './utils/secrets';
import { resolve } from 'path';
import { config } from 'dotenv';

export async function runServer(): Server {
  if (!isDevelopment() && !isTest()) {
    await retrieveSecrets();
  } else {
    config({ path: resolve(__dirname, `../.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV.toLocaleLowerCase()}` : ''}`) });
  }

  const server = await bootstrapServer();
  server.connections = await establishDatabaseConnection();
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
