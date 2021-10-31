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

    findOne.mockResolvedValue(false);
    
    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if the decryption of the org encryption key fails', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${chance.string()}`,
      }
    };

    findOne.mockResolvedValue({ encryptionKey: expectedEncryptionKey });
    (kmsUtil.decrypt as jest.MockedFunction<typeof kmsUtil.decrypt>).mockRejectedValue(new Error('error'));

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if the JWT cannot be verified', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      }
    };

    findOne.mockResolvedValue({ encryptionKey: expectedEncryptionKey });
    (kmsUtil.decrypt as jest.MockedFunction<typeof kmsUtil.decrypt>).mockResolvedValue(expectedEncryptionKey);
    jsonwebtoken.verify.mockImplementation(() => { throw new Error('error'); });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if the session key does not exist', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      }
    };

    findOne.mockResolvedValueOnce({ encryptionKey: expectedEncryptionKey })
           .mockResolvedValueOnce(false);
    (kmsUtil.decrypt as jest.MockedFunction<typeof kmsUtil.decrypt>).mockResolvedValue(expectedEncryptionKey);
    jsonwebtoken.verify.mockReturnValue({ sessionKey: expectedSessionKey });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if the mfa state is unverified', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      }
    };

    findOne.mockResolvedValueOnce({ encryptionKey: expectedEncryptionKey })
           .mockResolvedValueOnce({ mfaState: 'unverified' });
    (kmsUtil.decrypt as jest.MockedFunction<typeof kmsUtil.decrypt>).mockResolvedValue(expectedEncryptionKey);
    jsonwebtoken.verify.mockReturnValue({ sessionKey: expectedSessionKey });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should fail if the session has expired', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    const currentTime = new Date().getTime();
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      }
    };

    findOne.mockResolvedValueOnce({ encryptionKey: expectedEncryptionKey })
           .mockResolvedValueOnce({ mfaState: 'verified', expiresAt: new Date(currentTime - DAY_AS_MS) });
    (kmsUtil.decrypt as jest.MockedFunction<typeof kmsUtil.decrypt>).mockResolvedValue(expectedEncryptionKey);
    jsonwebtoken.verify.mockReturnValue({ sessionKey: expectedSessionKey });

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(mockResponse.status).toBeCalledWith(403);
    expect(json).toBeCalledWith({ error: 'Unauthorized' });
  });

  it('should successfully authorize the user and update their session', async () => {
    const expectedEncryptionKey = chance.string().toString('base64');
    const expectedToken = chance.string();
    const expectedSessionKey = chance.string();
    const currentTime = new Date().getTime();
    const expectedSession = { mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) };
    mockRequest = {
      cookies: { 'o': chance.string() },
      locale: 'en',
      headers: {
        'Authorization': `Bearer ${expectedToken}`,
      }
    };

    findOne.mockResolvedValueOnce({ encryptionKey: expectedEncryptionKey })
           .mockResolvedValueOnce({ mfaState: 'verified', expiresAt: new Date(currentTime + DAY_AS_MS) });
    (kmsUtil.decrypt as jest.MockedFunction<typeof kmsUtil.decrypt>).mockResolvedValue(expectedEncryptionKey);
    jsonwebtoken.verify.mockReturnValue({ sessionKey: expectedSessionKey });
    save.mockResolvedValue(true);

    Settings.now = () => new Date(2018, 4, 25).valueOf();

    await authorize(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(Organization, { where: { uniqueId: mockRequest.cookies.o } });
    expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedEncryptionKey);
    expect(jsonwebtoken.verify).toHaveBeenCalledWith(expectedToken, expectedEncryptionKey);
    expect(findOne).toHaveBeenCalledWith(Session, { where: { uniqueId: expectedSessionKey } });
    expect(save).toHaveBeenCalledWith({ lastActivityAt: new Date('2018-05-25T00:00:00.000Z'), ...expectedSession });
    expect(nextFunction).toBeCalled();
  });
});