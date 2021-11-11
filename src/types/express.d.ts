// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Organization, User } = require('src/entity');

declare namespace Express {
  export interface Request {
    locale?: string;
    user?: User;
    organization?: Organization;
  }
}