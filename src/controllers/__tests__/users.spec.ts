import { Chance } from 'chance';
import { Request, Response } from 'express';
import { __, configure } from 'i18n';
import { Settings } from 'luxon';
import { join } from 'path';

import {
  fetchUsers,
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
const save = jest.fn();
const update = jest.fn();
const mockEntityManager = { find, findAndCount, findOne, save, update };

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
  
  afterAll(async () => {
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
        where: { archived: false },
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
  });
});