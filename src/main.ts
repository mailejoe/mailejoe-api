import { Express } from 'express';
import { config } from 'dotenv';
import { resolve } from 'path';
import { Server } from 'http';
import { Connection } from 'typeorm';

import {
  establishDatabaseConnection,
  bootstrapServer,
} from './server';
import { isDevelopment, isTest } from './utils/env';
import { retrieveSecrets } from './utils/secrets';

let server: Server;
let dbConnections: Connection;

export async function runServer(): Promise<Express> {
  if (!isDevelopment() && !isTest()) {
    await retrieveSecrets();
  } else {
    config({ path: resolve(__dirname, `../.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV.toLocaleLowerCase()}` : ''}`) });
  }

  const mjServer = await bootstrapServer();
  dbConnections = await establishDatabaseConnection();
  await new Promise(resolve => {
    server = mjServer.listen(process.env.PORT, () => {
      console.log(`Server is now running on: ${process.env.HOST}:${process.env.PORT}`);
      resolve();
    });
  });
  return mjServer;
}

export async function stopServer(): Promise<void> {
  if (dbConnections) {
    await dbConnections.close();
  }
  await server.close();
}

if (!isTest()) {
  runServer();
}
