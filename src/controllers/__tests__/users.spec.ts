import { Chance } from 'chance';
import { Request, Response } from 'express';
import { __, configure } from 'i18n';
import { Settings } from 'luxon';
import { join } from 'path';

import {
  fetchUsers,
  fetchUser,
  createUser,
  updateUser,
} from '../users';
import { Organization } from '../../entity/Organization';
import { Role } from '../../entity/Role';
import { Session } from '../../entity/Session';
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
const mockEntityManager = { find, findAndCount, findOne, create, save, update };

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

describe('users', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let json = jest.fn();

  afterEach(async () => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRequest = {
      locale: 'en',
    };
    mockResponse = {
      status: jest.fn().mockReturnValue({ json }),
    };
  });

  afterEach(() => {
    mockRestore(mockResponse.status);
    mockRestore(json);
  });

  describe('fetchUsers', () => {
    afterEach(() => {
      mockRestore(findAndCount);
      mockRestore(save);
    });

    it('should return a 400 error if offset is non-numeric', async () => {
      mockRequest = {
        query: { offset: chance.word() },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`offset\` field must be between an integer between 0 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if offset is out of range', async () => {
      mockRequest = {
        query: { offset: '-1' },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`offset\` field must be between an integer between 0 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if limit is non-numeric', async () => {
      mockRequest = {
        query: { limit: chance.word() },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`limit\` field must be between an integer between 1 and 1000' });
    });

    it('should return a 400 error if limit is out of range', async () => {
      mockRequest = {
        query: { limit: '1001' },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`limit\` field must be between an integer between 1 and 1000' });
    });

    it('should return a 400 error if embed is not a string', async () => {
      mockRequest = {
        query: { embed: chance.integer() },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`embed\` field must be a string value.' });
    });

    it('should return a 400 error if embed contains an invalid value', async () => {
      mockRequest = {
        query: { embed: 'role,foobar' },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `embed` field must be a comma seperated list with values: organization,role' });
    });

    it('should return a 400 error if archived not a valid boolean', async () => {
      mockRequest = {
        query: { archived: chance.word() },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `archived` field must be a boolean value' });
    });

    it('should return 200 and empty list of users if no users exist', async () => {
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
            
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(User, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        take: 100,
        skip: 0,
      })
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: null,
        entityType: 'user',
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

    it('should return 200 and list of users with embeds', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };
      const expectedUsers = [{ [chance.word()]: chance.word() }, { [chance.word()]: chance.word() }];
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      
      mockRequest = {
        query: { embed: 'organization,role' },
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findAndCount, MockType.Resolve, [expectedUsers, 2]);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(User, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        relations: ['organization', 'role'],
        take: 100,
        skip: 0,
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: null,
        entityType: 'user',
        operation: 'View',
        info: JSON.stringify({ archived: 'false', offset: '0', limit: '100', embed: 'organization,role' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ total: 2, data: expectedUsers });
    });

    it('should return 200 and list of users with limit and offset', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };
      const expectedUsers = [{ [chance.word()]: chance.word() }, { [chance.word()]: chance.word() }];
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

      mockValue(findAndCount, MockType.Resolve, [expectedUsers, 2]);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(User, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        take: 10,
        skip: 1,
      })
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: null,
        entityType: 'user',
        operation: 'View',
        info: JSON.stringify({ archived: 'false', offset: '1', limit: '10', embed: '' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ total: 2, data: expectedUsers });
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
            
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(findAndCount).toBeCalledWith(User, {
        where: { organization_id: expectedSession.user.organization.id, archived: false },
        take: 100,
        skip: 0,
      });
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('fetchUser', () => {
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

      await fetchUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`id\` field is required.` });
    });

    it('should return a 400 error if id is non-numeric', async () => {
      mockRequest = {
        params: { id: chance.string() },
        query: {},
        ...mockRequest,
      };
      
      await fetchUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`id\` field must be between an integer between 1 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if id is out of range', async () => {
      mockRequest = {
        params: { id: '-1' },
        query: {},
        ...mockRequest,
      };
      
      await fetchUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`id\` field must be between an integer between 1 and ${Number.MAX_VALUE}` });
    });

    it('should return a 400 error if embed is not a string', async () => {
      mockRequest = {
        query: { embed: chance.integer() },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The \`embed\` field must be a string value.' });
    });

    it('should return a 400 error if embed contains an invalid value', async () => {
      mockRequest = {
        query: { embed: 'role,foobar' },
        ...mockRequest,
      };
      
      await fetchUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `embed` field must be a comma seperated list with values: organization,role' });
    });

    it('should return 404 if no users exist', async () => {
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
        params: { id: '1' },
        query: {},
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, false);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      Settings.now = () => new Date(2018, 4, 25).valueOf();
            
      await fetchUser(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { id: +mockRequest.params.id, organization_id: expectedSession.user.organization.id, archived: false },
      })
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: expectedSession.user.organization,
        entityId: 1,
        entityType: 'user',
        operation: 'View',
        info: JSON.stringify({ id: mockRequest.params.id, embed: '' }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedSession.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(404);
      expect(json).not.toHaveBeenCalled();
    });

    it('should return 500 and internal server error on unexpected error', async () => {
      const expectedSession = {
        user: { id: chance.word(), organization: chance.word() },
      };      
      mockRequest = {
        params: { id: '1' },
        query: {},
        session: expectedSession,
        ...mockRequest,
      };

      mockValue(findOne, MockType.Reject, new Error(chance.word));
            
      await fetchUser(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { id: 1, organization_id: expectedSession.user.organization.id, archived: false },
      });
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('createUser', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(save);
      mockRestore(create);
    });

    it('should return a 400 error if firstName is not included', async () => {
      mockRequest = {
        body: {},
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`firstName\` field is required.` });
    });

    it('should return a 400 error if firstName is not a string', async () => {
      mockRequest = {
        body: { firstName: chance.integer() },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`firstName\` field must be a string value.` });
    });

    it('should return a 400 error if lastName is not included', async () => {
      mockRequest = {
        body: { firstName: chance.string() },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`lastName\` field is required.` });
    });

    it('should return a 400 error if lastName is not a string', async () => {
      mockRequest = {
        body: { firstName: chance.string(), lastName: chance.integer() },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`lastName\` field must be a string value.` });
    });

    it('should return a 400 error if email is not included', async () => {
      mockRequest = {
        body: { firstName: chance.string(), lastName: chance.string() },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`email\` field is required.` });
    });

    it('should return a 400 error if email is an invalid format', async () => {
      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.string(),
        },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`email\` field must be a valid email identifier.` });
    });

    it('should return a 400 error if role is not included', async () => {
      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
        },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`role\` field is required.` });
    });

    it('should return a 400 error if role is non-numeric', async () => {
      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
          role: chance.string(),
        },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `role` field must be an integer' });
    });

    it('should return a 400 error if role is out of range', async () => {
      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
          role: -1,
        },
        query: {},
        ...mockRequest,
      };

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`role\` field must be between an integer between 1 and ${Number.MAX_VALUE}` });
    });

    it('should use organization enforce mfa and return 200', async () => {
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedUser = { id: chance.string(), [chance.string()]: chance.string() };

      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
          role: 1,
        },
        query: {},
        session: {
          user: {
            organization: {
              enforceMfa: true,
            },
          },
        },
        ...mockRequest,
      };

      mockValue(create, MockType.Resolve, expectedUser);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(create).toBeCalledWith(User, {
        ...mockRequest.body,
        organization: mockRequest.session.user.organization,
        mfaEnabled: true,
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'Create',
        info: JSON.stringify(mockRequest.body),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedUser);
    });

    it('should default mfa enabled to true if not provided and return 200', async () => {
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedUser = { id: chance.string(), [chance.string()]: chance.string() };

      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
          role: 1,
        },
        query: {},
        session: {
          user: {
            organization: {},
          },
        },
        ...mockRequest,
      };

      mockValue(create, MockType.Resolve, expectedUser);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(create).toBeCalledWith(User, {
        ...mockRequest.body,
        organization: mockRequest.session.user.organization,
        mfaEnabled: true,
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'Create',
        info: JSON.stringify(mockRequest.body),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedUser);
    });

    it('should use mfa setting provided and return 200', async () => {
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedUser = { id: chance.string(), [chance.string()]: chance.string() };

      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
          role: 1,
          mfaEnabled: false,
        },
        query: {},
        session: {
          user: {
            organization: {},
          },
        },
        ...mockRequest,
      };

      mockValue(create, MockType.Resolve, expectedUser);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(create).toBeCalledWith(User, {
        ...mockRequest.body,
        organization: mockRequest.session.user.organization,
        mfaEnabled: false,
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalledWith('208.38.230.51');
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'Create',
        info: JSON.stringify(mockRequest.body),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedUser);
    });

    it('should catch an error and return a 500', async () => {
      mockRequest = {
        body: {
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
          role: 1,
        },
        query: {},
        session: {
          user: {
            organization: {},
          },
        },
        ...mockRequest,
      };

      mockValue(create, MockType.Reject, new Error(chance.string()));

      await createUser(mockRequest as Request, mockResponse as Response);

      expect(create).toBeCalledWith(User, {
        ...mockRequest.body,
        organization: mockRequest.session.user.organization,
        mfaEnabled: true,
      });
      expect(ipinfoUtil.getIP).not.toHaveBeenCalled();
      expect(ipinfoUtil.getIPInfo).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('updateUser', () => {
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

      await updateUser(mockRequest as Request, mockResponse as Response);

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

      await updateUser(mockRequest as Request, mockResponse as Response);

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

      await updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Payload cannot be empty.' });
    });

    it('should return a 400 error if firstName is not a string', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { firstName: chance.integer() },
        ...mockRequest,
      };

      await updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`firstName\` field must be a string value` });
    });

    it('should return a 400 error if lastName is not a string', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { lastName: chance.integer() },
        ...mockRequest,
      };

      await updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`lastName\` field must be a string value` });
    });

    it('should return a 400 error if email is an invalid format', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { email: chance.string() },
        ...mockRequest,
      };

      await updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: `The \`email\` field must be a valid email identifier.` });
    });

    it('should return a 400 error if role is non-numeric', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { role: chance.string() },
        ...mockRequest,
      };

      await updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `role` field must be an integer' });
    });

    it('should return a 400 error if mfaEnabled is not a boolean', async () => {
      mockRequest = {
        params: {
          id: `${chance.integer()}`,
        },
        body: { mfaEnabled: chance.string() },
        ...mockRequest,
      };

      await updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'The `mfaEnabled` field must be a boolean value' });
    });
  });
});