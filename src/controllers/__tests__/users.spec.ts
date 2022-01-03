import { Chance } from 'chance';
import { Request, Response } from 'express';
import { __, configure } from 'i18n';
import { Settings } from 'luxon';
import { join } from 'path';
import { MoreThan, LessThanOrEqual } from 'typeorm';

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
const save = jest.fn();
const update = jest.fn();
const mockEntityManager = { find, findOne, save, update };

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
      mockRestore(findOne);
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
  });
});