import {
  KMSClient,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import { Chance } from 'chance';
import { Request, Response, NextFunction } from 'express';
import { configure } from 'i18n';
import { Settings } from 'luxon';
import { join } from 'path';
import * as request from 'supertest';
import { LessThanOrEqual } from 'typeorm';

import { authorize } from '../auth';
import { Organization } from '../../entity/Organization';
import { Session } from '../../entity/Session';
import * as kmsUtil from '../../utils/kms';

const chance = new Chance();
const findOne = jest.fn();
const save = jest.fn();
const mockEntityManager = { findOne, save };
const kmsMock = mockClient(KMSClient);

jest.mock('typeorm', () => {
  return {
    ...(jest.requireActual('typeorm')),
    getManager: jest.fn(() => mockEntityManager),
  };
});

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/../../locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

describe('auth', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();
  let json = jest.fn();
  
  afterAll(async () => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnValue({ json }),
    };
  });

  it('should fail if no cookie exists', async () => {
    mockRequest = {
      cookies: {},
      locale: 'en',
    };
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if no authorization header exists', async () => {
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {}
    };
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if authorization header not a bearer token', async () => {
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': chance.string(),
      }
    };
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if the org does not exist', async () => {
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${chance.string()}`,
      }
    };

    findOne.mockReturnValue(false);
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });
});