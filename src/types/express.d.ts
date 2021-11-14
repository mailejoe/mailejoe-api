// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Session } = require('src/entity');

declare namespace Express {
  export interface Request {
    locale?: string;
    session?: Session;
  }
}