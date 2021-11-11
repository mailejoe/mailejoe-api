import { Chance } from 'chance';
import { Request, Response, NextFunction } from 'express';
import { configure } from 'i18n';
import * as jsonwebtoken from 'jsonwebtoken';
import { Settings } from 'luxon';
import { join } from 'path';

import { authorize } from '../auth';
import { Organization } from '../../entity/Organization';
import { Session } from '../../entity/Session';
import * as kmsUtil from '../../utils/kms';

import { MockType, mockValue } from '../../testing';

const DAY_AS_MS = 24 * 60 * 60 * 1000;

const chance = new Chance();
const findOne = jest.fn();
const save = jest.fn();
const mockEntityManager = { findOne, save };

jest.mock('jsonwebtoken');
jest.mock('typeorm', () => {
  return {
    ...(jest.requireActual('typeorm')),
    getManager: jest.fn(() => mockEntityManager),
  };
});
jest.mock('../../utils/kms');

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/../../locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

describe('auth middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();
  let json = jest.fn();
  
  afterAll(async () => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRequest = {
      cookies: {},
      headers: {},
      locale: 'en',
    };
    mockResponse = {
      status: jest.fn().mockReturnValue({ json }),
    };
  });

  it('should fail if no cookie exists', async () => {
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if no authorization header exists', async () => {
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
    };
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if authorization header not a bearer token', async () => {
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': chance.string(),
      },
    };
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if the org does not exist', async () => {
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${chance.string()}`,
      },
    };

    mockValue(findOne, MockType.Resolve, false);

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if the decryption of the org encryption key fails', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${chance.string()}`,
      },
    };

    mockValue(findOne, MockType.Resolve, { encryptionKey: expectedEncryptionKey });
    mockValue(kmsUtil.decrypt, MockType.Reject, new Error('error'));

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if the JWT cannot be verified', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.Resolve, { encryptionKey: expectedEncryptionKey });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    jsonwebtoken.verify.mockImplementation(() => { throw new Error('error'); });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if the session key does not exist', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, false);
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if the mfa state is unverified', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, { mfaState: 'unverified' });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should fail if the session has expired', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    const currentTime = new Date().getTime();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, { mfaState: 'verified', expiresAt: new Date(currentTime - DAY_AS_MS) });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.user).toBeUndefined();
    expect(mockRequest.organization).toBeUndefined();
  });

  it('should successfully authorize the user and update their session', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedUser = chance.string();
    const expectedOrganization = chance.string();
    const expectedSessionKey = chance.string();
    const currentTime = new Date().getTime();
    const expectedSession = { user: expectedUser, organization: expectedOrganization, mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) };
    // const { user, organization, ...sessionWithRefs } = expectedSession;
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, { user: expectedUser, organization: expectedOrganization, mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });
    mockValue(save, MockType.Resolve, true);

    Settings.now = () => new Date(2018, 4, 25).valueOf();

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(save).toHaveBeenCalledWith({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
    expect(nextFunction).toBeCalled();
    expect(mockRequest.user).toBe(expectedUser);
    expect(mockRequest.organization).toBe(expectedOrganization);
  });
});