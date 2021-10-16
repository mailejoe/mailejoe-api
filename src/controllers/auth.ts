import { Request, ResponseToolkit } from '@hapi/hapi';
import { getManager } from 'typeorm';
import { Organization } from '../entity';
import * as audits from '../utils/audits';

export async function login(req: Request, h: ResponseToolkit) {
  const { username, password } = req.payload;

  console.log('accountLookup', username, Organization);

  try {
  const sql = await getManager()
    .createQueryBuilder(Organization,'organization')
    //.innerJoin('user.organizationId', 'linkedOrg', 'user.username = :username', { username })
    .where('organization.id = :id', { id: 1 })
    .getOne();
    console.log(sql);
  } catch (err) {
    console.log(err);
  }


  return 'hello';
}