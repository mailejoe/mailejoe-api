import { Reqest, ResponseToolkit } from '@hapi/hapi';
import * as Joi from '@hapi/joi';
import { getManager } from 'typeorm';
import * as audits from '../utils/audits';
import { Organization } from '../entity';

export async function fetchById(req: Request, h: ResponseToolkit) {
  const entityManager = getManager();
  const org = await entityManager.findOne(Organization, 1);

  h.response(org);
}
