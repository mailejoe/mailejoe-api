import * as express from 'express';
import { createConnection, Connection } from 'typeorm';
import { isDevelopment, isTest } from './utils/env';
import { configure } from 'i18n';
import { join } from 'path';
import * as helmet from 'helmet';

import {
  attachRoutes,
} from './routes';
import { getLocale } from './utils/locale';

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

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
        logging: process.env.NODE_ENV === 'prod' ? ['error'] : ['query', 'error'],
        extra: {
          min: 2,
          max: isDevelopment() || isTest() ? 50 : 2,
          connectionTimeoutMillis: 2000,
          idleTimeoutMillis: 30000,
        }
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export const bootstrapServer = async (): Promise<express.Express> => {
  const app = express();
  app.set('trust proxy', true);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true}));
  app.use(helmet());
  app.use((req: express.Request, _: express.Response | { locale: string }, next: express.NextFunction) => {
    req.locale = getLocale(req);
    next();
  });
  attachRoutes(app);
  return app;
};
