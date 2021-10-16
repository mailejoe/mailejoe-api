import { Server } from '@hapi/hapi';
import { createConnection, Connection } from 'typeorm';
import { isDevelopment, isTest } from './utils/env';

import {
  attachRoutes,
} from './routes';

process.on('unhandledRejection', reason => {
  console.error(reason);
});

process.on('uncaughtException', reason => {
  console.error(reason);
});

export const establishDatabaseConnection = async (): Promise<Connection> => {
  try {
    return createConnection({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        entities: [
          __dirname + '/entity/*.ts'
        ],
        synchronize: false,
        extra: {
          min: 2,
          max: isDevelopment() || isTest() ? 50 : 10,
          connectionTimeoutMillis: 2000,
          idleTimeoutMillis: 30000,
        }
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export const bootstrapServer = async (): Server => {
  const server = Server({
    port: Number(process.env.PORT),
    host: process.env.HOST,
    load: { sampleInterval: 1000 }
  });

  attachRoutes(server);
  await server.start()

  return server;
};
