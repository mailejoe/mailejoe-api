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
    console.log('cors?');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Cache, Authorization, Origin, Accept, X-Requested-With, Content-Type, Content-Length, Access-Control-Request-Method, Access-Control-Request-Headers');

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
