import { Chance } from 'chance';
import { Request, Response, NextFunction } from 'express';
import { configure } from 'i18n';
import * as jsonwebtoken from 'jsonwebtoken';
import { Settings } from 'luxon';
import { join } from 'path';

import { authorize } from '../auth';
import * as db from '../../database';
import { Organization } from '../../entity/Organization';
import { Session } from '../../entity/Session';
import { User } from '../../entity/User';
import * as kmsUtil from '../../utils/kms';

import { MockType, mockValue } from '../../testing';

const DAY_AS_MS = 24 * 60 * 60 * 1000;

const chance = new Chance();
const findOne = jest.fn();
const save = jest.fn();
const mockEntityManager = { findOne, save };

jest.mock('jsonwebtoken');
jest.mock('../../database');
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
  
  beforeAll(async () => {
    mockValue(db.getDataSource, MockType.Return, { manager: mockEntityManager });
  });

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
    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if no authorization header exists', async () => {
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
    };
    
    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if authorization header not a bearer token', async () => {
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': chance.string(),
      },
    };
    
    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if the org does not exist', async () => {
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${chance.string()}`,
      },
    };

    mockValue(findOne, MockType.Resolve, false);

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if the decryption of the org encryption key fails', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${chance.string()}`,
      },
    };

    mockValue(findOne, MockType.Resolve, { encryptionKey: expectedEncryptionKey });
    mockValue(kmsUtil.decrypt, MockType.Reject, new Error('error'));

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if the JWT cannot be verified', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.Resolve, { encryptionKey: expectedEncryptionKey });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    jsonwebtoken.verify.mockImplementation(() => { throw new Error('error'); });

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if the session key does not exist', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, false);
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey }, relations: ['organization', 'user'] });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should fail if the mfa state is unverified', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, { mfaState: 'unverified' });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey }, relations: ['organization', 'user'] });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should successfully authorize if pre MFA and setup in progress', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    const expectedUser = {
      id: chance.word(),
      [chance.string()]: chance.string(),
    };
    const expectedOrganization = chance.string();
    const currentTime = new Date().getTime();
    const expectedSession = { id: chance.word(), user: expectedUser, organization: expectedOrganization, mfaState: 'unverified', expiresAt: new Date(currentTime + DAY_AS_MS) };
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, expectedSession, { mfaSecret: null });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize(true)(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey }, relations: ['organization', 'user'] });
    expect(findOne).toHaveBeenCalledWith(User, {
      where: { id: expectedSession.user.id },
      select: {
        mfaSecret: true,
      }
    });
    expect(save).toHaveBeenCalledWith({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.session).toStrictEqual({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
  });

  it('should successfully authorize if pre MFA and already verified', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    const expectedUser = {
      id: chance.word(),
      [chance.string()]: chance.string(),
    };
    const expectedOrganization = chance.string();
    const currentTime = new Date().getTime();
    const expectedSession = { id: chance.word(), user: expectedUser, organization: expectedOrganization, mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) };
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, expectedSession, { mfaSecret: null });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize(true)(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey }, relations: ['organization', 'user'] });
    expect(findOne).toHaveBeenCalledWith(User, {
      where: { id: expectedSession.user.id },
      select: {
        mfaSecret: true,
      }
    });
    expect(save).toHaveBeenCalledWith({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.session).toStrictEqual({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
  });

  it('should fail if the session has expired', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    const currentTime = new Date().getTime();
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, { mfaState: 'verified', expiresAt: new Date(currentTime - DAY_AS_MS) });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey }, relations: ['organization', 'user'] });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
    expect(mockRequest.session).toBeUndefined();
  });

  it('should successfully authorize the user and update their session', async () => {
    const expectedEncryptionKey = chance.string().toString('hex');
    const expectedToken = chance.string();
    const expectedUser = chance.string();
    const expectedOrganization = chance.string();
    const expectedSessionKey = chance.string();
    const currentTime = new Date().getTime();
    const expectedSession = { user: expectedUser, organization: expectedOrganization, mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) };
    mockRequest = {
      ...mockRequest,
      cookies: { 'o': chance.string() },
      headers: {
        'authorization': `Bearer ${expectedToken}`,
      },
    };

    mockValue(findOne, MockType.ResolveOnce, { encryptionKey: expectedEncryptionKey }, { user: expectedUser, organization: expectedOrganization, mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) });
    mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
    mockValue(jsonwebtoken.verify, MockType.Return, { sessionKey: expectedSessionKey });
    mockValue(save, MockType.Resolve, true);

    Settings.now = () => new Date(2018, 4, 25).valueOf();

    await authorize()(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, {
      select: {
        id: true,
        encryptionKey: true,
      },
      where: { uniqueId: mockRequest.cookies.o }
    });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey }, relations: ['organization', 'user'] });
    expect(save).toHaveBeenCalledWith({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
    expect(nextFunction).toBeCalled();
    expect(mockRequest.session).toStrictEqual({ lastActivityAt: new Date('2018-05-25T05:00:00.000Z'), ...expectedSession });
  });
});