import { Chance } from 'chance';
import { Request, Response } from 'express';
import { __, configure } from 'i18n';
import { Settings } from 'luxon';
import { join } from 'path';

import {
  fetchRoles,
  fetchRole,
  createRole,
  updateRole,
  deleteRole,
} from '../roles';
import { Permission } from '../../entity/Permission';
import { Role } from '../../entity/Role';
import { User } from '../../entity/User';
import * as ipinfoUtil from '../../utils/ip-info';

import { MockType, mockValue, mockRestore } from '../../testing';

const chance = new Chance();
const findOne = jest.fn();
const find = jest.fn();
const findAndCount = jest.fn();
const create = jest.fn();
const save = jest.fn();
const update = jest.fn();
const deleteFn = jest.fn();
const createQueryBuilder = jest.fn().mockReturnValue({
  insert: jest.fn().mockReturnValue({
    into: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        execute: jest.fn()
      })
    })
  })
});
const mockEntityManager = {
  createQueryBuilder,
  find,
  findAndCount,
  findOne,
  create,
  save,
  update,
  delete: deleteFn
};

jest.mock('typeorm', () => {
  return {
    ...(jest.requireActual('typeorm')),
    getManager: jest.fn(() => mockEntityManager),
  };
});
jest.mock('../../utils/ip-info');

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/../../locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

describe('roles', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let json = jest.fn();
  let end = jest.fn();

  afterEach(async () => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRequest = {
      locale: 'en',
    };
    mockResponse = {
      status: jest.fn().mockReturnValue({ json, end }),
    };
  });

  afterEach(() => {
    mockRestore(mockResponse.status);
    mockRestore(json);
  });

  describe('fetchRoles', () => {
    afterEach(() => {
      mockRestore(findAndCount);
      mockRestore(save);
    });

    it('should return a 400 error if offset is non-numeric', async () => {
      mockRequest = {
        query: { offset: chance.word() },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`offset\` field must be between an integer between 0 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if offset is out of range', async () => {
      mockRequest = {
        query: { offset: '-1' },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`offset\` field must be between an integer between 0 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if limit is non-numeric', async () => {
      mockRequest = {
        query: { limit: chance.word() },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`limit\` field must be between an integer between 1 and 1000' });
    });

    it('should return a 400 error if limit is out of range', async () => {
      mockRequest = {
        query: { limit: '1001' },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`limit\` field must be between an integer between 1 and 1000' });
    });

    it('should return a 400 error if embed is not a string', async () => {
      mockRequest = {
        query: { embed: chance.integer() },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`embed\` field must be a string value.' });
    });

    it('should return a 400 error if embed contains an invalid value', async () => {
      mockRequest = {
        query: { embed: chance.string() },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `embed` field must be a comma seperated list with values: permission' });
    });

    it('should return a 400 error if archived not a valid boolean', async () => {
      mockRequest = {
        query: { archived: chance.word() },
        ...mockRequest,
      };
      
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `archived` field must be a boolean value' });
    });

    it('should return 200 and empty list of roles if no roles exist', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      
      mockRequest = {
        query: {},
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findAndCount, MockType.Resolve, [[], 0]);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(Role, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        take: 100,
        skip: 0,
      })
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: null,
        entityType: 'role',
        operation: 'View',
        info: JSON.stringify({ archived: 'false', offset: '0', limit: '100', embed: '' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ total: 0, data: [] });
    });

    it('should return 200 and list of roles with embeds', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };
      const expectedRoles = [{ [chance.word()]: chance.word() }, { [chance.word()]: chance.word() }];
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      
      mockRequest = {
        query: { embed: 'permission' },
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findAndCount, MockType.Resolve, [expectedRoles, 2]);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(Role, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        relations: ['permission'],
        take: 100,
        skip: 0,
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: null,
        entityType: 'role',
        operation: 'View',
        info: JSON.stringify({ archived: 'false', offset: '0', limit: '100', embed: 'permission' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ total: 2, data: expectedRoles });
    });

    it('should return 200 and list of roles with limit and offset', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };
      const expectedRoles = [{ [chance.word()]: chance.word() }, { [chance.word()]: chance.word() }];
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      
      mockRequest = {
        query: { limit: '10', offset: '1' },
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findAndCount, MockType.Resolve, [expectedRoles, 2]);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(Role, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        take: 10,
        skip: 1,
      })
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: null,
        entityType: 'role',
        operation: 'View',
        info: JSON.stringify({ archived: 'false', offset: '1', limit: '10', embed: '' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ total: 2, data: expectedRoles });
    });
    
    it('should return 500 and internal server error on unexpected error', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };      
      mockRequest = {
        query: {},
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findAndCount, MockType.Reject, new Error(chance.word));
            
      await fetchRoles(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(Role, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        take: 100,
        skip: 0,
      });
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('fetchRole', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(save);
    });

    it('should return a 400 error if id not included', async () => {
      mockRequest = {
        params: {},
        query: {},
        ...mockRequest,
      };

      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`id\` field is required.` });
    });

    it('should return a 400 error if id is non-numeric', async () => {
      mockRequest = {
        params: { id: chance.string() },
        query: {},
        ...mockRequest,
      };
      
      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`id\` field must be between an integer between 1 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if id is out of range', async () => {
      mockRequest = {
        params: { id: '-1' },
        query: {},
        ...mockRequest,
      };
      
      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`id\` field must be between an integer between 1 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if embed is not a string', async () => {
      mockRequest = {
        params: { id: `${chance.integer({ min: 1 })}` },
        query: { embed: chance.integer() },
        ...mockRequest,
      };
      
      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`embed\` field must be a string value.' });
    });

    it('should return a 400 error if embed contains an invalid value', async () => {
      mockRequest = {
        params: { id: `${chance.integer({ min: 1 })}` },
        query: { embed: chance.string() },
        ...mockRequest,
      };
      
      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `embed` field must be a comma seperated list with values: permission' });
    });

    it('should return 404 if no role id exist', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      
      mockRequest = {
        params: { id: `${chance.integer({ min: 1 })}` },
        query: {},
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, false);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, {
        where: { id: +mockRequest.params.id, organization_id: expectedSession.user.organization.id, archived: false },
      })
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: +mockRequest.params.id,
        entityType: 'role',
        operation: 'View',
        info: JSON.stringify({ id: mockRequest.params.id, embed: '' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(404);
      expect(end).toHaveBeenCalled();
    });

    it('should return 500 and internal server error on unexpected error', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };      
      mockRequest = {
        params: { id: `${chance.integer({ min: 1 })}` },
        query: {},
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findOne, MockType.Reject, new Error(chance.word));
            
      await fetchRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, {
        where: { id: +mockRequest.params.id, organization_id: expectedSession.user.organization.id, archived: false },
      });
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });
  
  describe('createRole', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(save);
      mockRestore(create);
    });

    it('should return a 400 error if name is not included', async () => {
      mockRequest = {
        body: {},
        query: {},
        ...mockRequest,
      };

      await createRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`name\` field is required.` });
    });

    it('should return a 400 error if name is not a string', async () => {
      mockRequest = {
        body: { name: chance.integer() },
        query: {},
        ...mockRequest,
      };

      await createRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`name\` field must be a string value.` });
    });

    it('should return a 400 error if permissions is not included', async () => {
      mockRequest = {
        body: { name: chance.string() },
        query: {},
        ...mockRequest,
      };

      await createRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`permissions\` field is required.` });
    });

    it('should return a 400 error if permissions is not an array', async () => {
      mockRequest = {
        body: { name: chance.string(), permissions: chance.integer() },
        query: {},
        ...mockRequest,
      };

      await createRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`permissions\` field must be a array value` });
    });

    it('should return a 400 error if one or more permissions is invalid', async () => {
      mockRequest = {
        body: { name: chance.string(), permissions: ['VIEW_USER', chance.string()] },
        query: {},
        ...mockRequest,
      };

      await createRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The permission ${mockRequest.body.permissions[1]} is not valid.` });
    });

    it('should successfully create a new role and return a 200', async () => {
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedRole = { id: chance.string(), [chance.string()]: chance.string() };
      
      mockRequest = {
        body: {
          name: chance.string(),
          description: chance.string(),
          permissions: ['VIEW_USER','VIEW_ROLE'],
        },
        query: {},
        session: {
          user: {
            organization: {
              id: chance.string(),
            },
          },
        },
        ...mockRequest,
      };

      mockValue(create, MockType.Resolve, expectedRole);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await createRole(mockRequest as Request, mockResponse as Response);

      const { permissions, ...other } = mockRequest.body;
      expect(create).toBeCalledWith(Role, {
        ...other,
        organization: mockRequest.session.user.organization,
      });
      expect(createQueryBuilder).toBeCalled();
      expect(createQueryBuilder().insert).toBeCalled();
      expect(createQueryBuilder().insert().into).toBeCalledWith(Permission);
      expect(createQueryBuilder().insert().into().values).toBeCalledWith([
        { role: expectedRole, permission: 'VIEW_USER' },
        { role: expectedRole, permission: 'VIEW_ROLE' },
      ]);
      expect(createQueryBuilder().insert().into().values().execute).toBeCalledWith();
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: expectedRole.id,
        entityType: 'role',
        operation: 'Create',
        info: JSON.stringify(mockRequest.body),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedRole);
    });

    it('should catch an error and return a 500', async () => {
      mockRequest = {
        body: {
          name: chance.string(),
          description: chance.string(),
          permissions: ['VIEW_USER'],
        },
        query: {},
        session: {
          user: {
            organization: {
              id: chance.string(),
            },
          },
        },
        ...mockRequest,
      };

      mockValue(create, MockType.Reject, new Error(chance.string()));

      await createRole(mockRequest as Request, mockResponse as Response);

      const { permissions, ...other } = mockRequest.body;
      expect(create).toBeCalledWith(Role, {
        ...other,
        organization: mockRequest.session.user.organization,
      });
      expect(ipinfoUtil.getIP).not.toHaveBeenCalled();
      expect(ipinfoUtil.getIPInfo).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('updateRole', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(save);
      mockRestore(update);
    });

    it('should return a 400 error if id is not provided', async () => {
      mockRequest = {
        params: {},
        body: {},
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `id` field is required.' });
    });

    it('should return a 400 error if id is not a numeric string', async () => {
      mockRequest = {
        params: {
          id: chance.string(),
        },
        body: {},
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `id` field must be an integer' });
    });

    it('should return a 400 error if payload is empty', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: {},
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Payload cannot be empty.' });
    });

    it('should return a 400 error if name is not a string', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { name: chance.integer() },
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`name\` field must be a string value` });
    });

    it('should return a 400 error if description is not a string', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { description: chance.integer() },
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`description\` field must be a string value` });
    });

    it('should return a 400 error if permissions is not an array', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { permissions: chance.string() },
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`permissions\` field must be a array value` });
    });

    it('should return a 400 error if permissions contains an invalid value', async () => {
      const randomPermission = chance.string();
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { permissions: ['VIEW_USER', randomPermission] },
        ...mockRequest,
      };

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The permission ${randomPermission} is not valid.` });
    });

    it('should return a 404 error if role id does not exist', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer({ min: 1, max: 1000 })}`,
        },
        body: { name: chance.string() },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, false);

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, { id: +mockRequest.params.id, archived: false });
      expect(mockResponse.status).toBeCalledWith(404);
      expect(end).toHaveBeenCalled();
    });

    it('should return a 200 and successfully update the role when no permissions supplied', async () => {
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedRole = { [chance.string()]: chance.string() };
      
      mockRequest = {
        params: {
          id: `${chance.integer({ min: 1, max: 1000 })}`,
        },
        body: {
          name: chance.string(),
          description: chance.string()
        },
        session: {
          user: {
            id: chance.string(),
            organization: {
              enforceMfa: true,
            },
          },
        },
        ...mockRequest,
      };

      mockValue(update, MockType.Resolve, true);
      mockValue(findOne, MockType.Resolve, true, expectedRole);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(update).toBeCalledWith(Role, {
        ...mockRequest.body
      }, { id: +mockRequest.params.id });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: +mockRequest.params.id,
        entityType: 'role',
        operation: 'Update',
        info: JSON.stringify(mockRequest.body),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(findOne).toHaveBeenCalledWith(Role, {
        id: +mockRequest.params.id, archived: false,
      });
      expect(findOne).toHaveBeenCalledWith(Role, {
        id: +mockRequest.params.id,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedRole);
    });

    it('should return a 200 and successfully update the role when permissions are supplied', async () => {
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedRole = { [chance.string()]: chance.string() };
      
      mockRequest = {
        params: {
          id: `${chance.integer({ min: 1, max: 1000 })}`,
        },
        body: {
          name: chance.string(),
          permissions: ['VIEW_USER','ADD_USER','VIEW_ROLE'],
        },
        session: {
          user: {
            id: chance.string(),
            organization: {
              enforceMfa: true,
            },
          },
        },
        ...mockRequest,
      };

      mockValue(update, MockType.Resolve, true);
      mockValue(findOne, MockType.Resolve, expectedRole);
      mockValue(deleteFn, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(update).toBeCalledWith(Role, {
        name: mockRequest.body.name
      }, { id: +mockRequest.params.id });
      expect(deleteFn).toHaveBeenCalledWith(Permission, { role: expectedRole });
      expect(createQueryBuilder).toHaveBeenCalledWith();
      expect(createQueryBuilder().insert).toHaveBeenCalledWith();
      expect(createQueryBuilder().insert().into).toHaveBeenCalledWith(Permission);
      expect(createQueryBuilder().insert().into().values).toHaveBeenCalledWith([
        { role: expectedRole, permission: 'VIEW_USER' },
        { role: expectedRole, permission: 'ADD_USER' },
        { role: expectedRole, permission: 'VIEW_ROLE' },
      ]);
      expect(createQueryBuilder().insert().into().values().execute).toHaveBeenCalledWith();
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: +mockRequest.params.id,
        entityType: 'role',
        operation: 'Update',
        info: JSON.stringify(mockRequest.body),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(findOne).toHaveBeenCalledWith(Role, {
        id: +mockRequest.params.id, archived: false,
      });
      expect(findOne).toHaveBeenCalledWith(Role, {
        id: +mockRequest.params.id,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedRole);
    });

    it('should catch an error and return a 500', async () => {
      mockRequest = {
        body: {
          name: chance.string(),
        },
        params: {
          id: `${chance.integer({ min: 1, max: 1000 })}`,
        },
        session: {
          user: {
            organization: {
              enforceMfa: true,
            },
          },
        },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, true);
      mockValue(update, MockType.Reject, new Error(chance.string()));

      await updateRole(mockRequest as Request, mockResponse as Response);

      expect(update).toBeCalledWith(Role, {
        ...mockRequest.body
      }, { id: +mockRequest.params.id });
      expect(ipinfoUtil.getIP).not.toHaveBeenCalled();
      expect(ipinfoUtil.getIPInfo).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('deleteRole', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(save);
      mockRestore(update);
    });

    it('should return a 400 error if id is not provided', async () => {
      mockRequest = {
        params: {},
        body: {},
        ...mockRequest,
      };

      await deleteRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `id` field is required.' });
    });

    it('should return a 400 error if id is not a numeric string', async () => {
      mockRequest = {
        params: {
          id: chance.string(),
        },
        body: {},
        ...mockRequest,
      };

      await deleteRole(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `id` field must be an integer' });
    });

    it('should return a 404 if the role id does not exist', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: {},
        session: {
          user: {
            id: chance.string(),
            organization: {},
          },
        },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, false);

      await deleteRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, { id: +mockRequest.params.id, archived: false });
      expect(mockResponse.status).toBeCalledWith(404);
      expect(end).toHaveBeenCalled();
    });

    it('should return a 400 if the role is still assigned to one or more users', async () => {
      const expectedRole = { [chance.string()]: chance.string() };
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: {},
        session: {
          user: {
            id: chance.string(),
            organization: {},
          },
        },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, expectedRole);
      mockValue(find, MockType.Resolve, [chance.string()]);

      await deleteRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, { id: +mockRequest.params.id, archived: false });
      expect(find).toBeCalledWith(User, { role: expectedRole });
      expect(mockResponse.status).toBeCalledWith(400);
    });

    it('should return a 204 and successfully delete the role', async () => {
      const expectedRole = { [chance.string()]: chance.string() };
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: {},
        session: {
          user: {
            id: chance.string(),
            organization: {},
          },
        },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, expectedRole);
      mockValue(find, MockType.Resolve, []);
      mockValue(update, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await deleteRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, { id: +mockRequest.params.id, archived: false });
      expect(find).toBeCalledWith(User, { role: expectedRole });
      expect(update).toBeCalledWith(Role, { archived: true }, { id: +mockRequest.params.id });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: +mockRequest.params.id,
        entityType: 'role',
        operation: 'Delete',
        info: JSON.stringify({}),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(204);
      expect(end).toHaveBeenCalled();
    });

    it('should catch an error and return a 500', async () => {
      const expectedRole = { [chance.string()]: chance.string() };
      mockRequest = {
        body: {},
        params: {
          id: `${chance.integer()}`,
        },
        session: {
          user: {
            organization: {
              enforceMfa: true,
            },
          },
        },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, expectedRole);
      mockValue(find, MockType.Resolve, []);
      mockValue(update, MockType.Reject, new Error(chance.string()));

      await deleteRole(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(Role, { id: +mockRequest.params.id, archived: false });
      expect(find).toBeCalledWith(User, { role: expectedRole });
      expect(update).toBeCalledWith(Role, { archived: true }, { id: +mockRequest.params.id });
      expect(ipinfoUtil.getIP).not.toHaveBeenCalled();
      expect(ipinfoUtil.getIPInfo).not.toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });
});