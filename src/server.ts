import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as helmet from 'helmet';
import { configure } from 'i18n';
import { join } from 'path';

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

export const bootstrapServer = async (): Promise<express.Express> => {
  const app = express();
  app.set('trust proxy', true);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true}));
  app.use(cookieParser());
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    if ('OPTIONS' === req.method) {
      res.send(200);
    }
    else {
      next();
    }
  });
  app.use(helmet());
  app.use((req: express.Request, _: express.Response | { locale: string }, next: express.NextFunction) => {
    req.locale = getLocale(req);
    next();
  });
  attachRoutes(app);
  return app;
};
