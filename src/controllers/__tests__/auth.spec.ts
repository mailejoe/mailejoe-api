import * as bcrypt from 'bcrypt';
import { Chance } from 'chance';
import { Request, Response } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import { Settings } from 'luxon';
import { LessThanOrEqual } from 'typeorm';
import { configure } from 'i18n';
import { join } from 'path';

import {
  login,
  setupOrganization,
} from '../auth';
import { Organization } from '../../entity/Organization';
import { Session } from '../../entity/Session';
import { User } from '../../entity/User';
import * as ipinfoUtil from '../../utils/ip-info';
import * as kmsUtil from '../../utils/kms';
import { values } from 'lodash';

const chance = new Chance();
const findOne = jest.fn();
const find = jest.fn();
const save = jest.fn();
const mockEntityManager = { find, findOne, save };
const expectedRandomStr = chance.string();

jest.mock('bcrypt');
jest.mock('crypto', () => {
  return {
    ...(jest.requireActual('crypto')),
    randomBytes: jest.fn(() => expectedRandomStr),
  };
});
jest.mock('jsonwebtoken');
jest.mock('typeorm', () => {
  return {
    ...(jest.requireActual('typeorm')),
    getManager: jest.fn(() => mockEntityManager),
  };
});
jest.mock('../../utils/ip-info');
jest.mock('../../utils/kms');

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/../../locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

enum MockType {
  Resolve = 'mockResolvedValue',
  ResolveOnce = 'mockResolvedValueOnce',
  Return = 'mockReturnValue',
  ReturnOnce = 'mockReturnValueOnce',
}

function mockValue(fn: (...args: any[]) => any, type: MockType, ...values: any) {
  if (values.length === 1) {
    (fn as jest.MockedFunction<typeof fn>)[type](values[0]);
  } else {
    let returnedFn = (fn as jest.MockedFunction<typeof fn>)[type](values[0]);
    values.slice(1).forEach((value: any) => {
      returnedFn = returnedFn[type](value);
    });
  }
}

function mockRestore(fn: (...args: any[]) => any) {
  (fn as jest.MockedFunction<typeof fn>).mockRestore();
}

describe('auth', () => {
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
    json.mockRestore();
  });

  describe('setupOrganization', () => {
    afterEach(() => {
      findOne.mockRestore();
      save.mockRestore();
    });
    
    describe.each([
      { field: 'orgName', previousObj: {} },
      { field: 'firstName', previousObj: { orgName: chance.string() } },
      { field: 'lastName', previousObj: { orgName: chance.string(), firstName: chance.string() } },
      { field: 'email', previousObj: { orgName: chance.string(), firstName: chance.string(), lastName: chance.string() } },
    ])('validate param($field)', ({ field, previousObj }) => {
      it(`should return a 400 error if ${field} does not exist`, async () => {
        mockRequest = {
          body: previousObj,
          ...mockRequest,
        };
        
        await setupOrganization(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
      });

      it(`should return a 400 error if ${field} is not defined`, async () => {
        mockRequest = {
          body: { [field]: null, ...previousObj },
          ...mockRequest,
        };
        
        await setupOrganization(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
      });

      it(`should return a 400 error if ${field} is not a string`, async () => {        
        mockRequest = {
          body: { [field]: 1, ...previousObj },
          ...mockRequest,
        };

        await setupOrganization(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a string value.` });
      });

      it(`should return a 400 error if ${field} exceeds the string length limit`, async () => {
        mockRequest = {
          body: { [field]: new Array(field !== 'email' ? 300 : 1050).join('a'), ...previousObj },
          ...mockRequest,
        };
        
        await setupOrganization(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field must be between 1 and ${field !== 'email' ? 255 : 1024} characters in length.` });
      });

      if (field === 'email') {
        it(`should return a 400 error if ${field} is not a valid email string`, async () => {
          mockRequest = {
            body: { [field]: chance.string(), ...previousObj },
            ...mockRequest,
          };
          
          await setupOrganization(mockRequest as Request, mockResponse as Response);

          expect(mockResponse.status).toBeCalledWith(400);
          expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a valid email identifier.` });
        });
      }
    });

    it(`should return a 400 error if orgName is not unique`, async () => {
      const expectedOrgName = chance.string();
      mockRequest = {
        body: { orgName: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
        ...mockRequest,
      };
      
      findOne.mockReturnValueOnce(true);
      
      await setupOrganization(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(Organization, { where: { name: expectedOrgName } });
      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Organization name must be unique' });
    });

    it(`should return a 400 error if email is not unique`, async () => {
      const expectedEmail = chance.email();      
      mockRequest = {
        body: { orgName: chance.string(), firstName: chance.string(), lastName: chance.string(), email: expectedEmail },
        ...mockRequest,
      };

      findOne.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      await setupOrganization(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Email must be unique' });
    });

    describe('org being created', () => {
      let defaultNewOrganization,
          defaultNewUser;
      
      beforeAll(() => {
        defaultNewOrganization = jest.spyOn(Organization, 'defaultNewOrganization');
        defaultNewUser = jest.spyOn(User, 'defaultNewUser');
      });

      afterEach(() => {
        defaultNewOrganization.mockClear();
        defaultNewUser.mockClear();
      });

      it(`should return a 500 if fails to save new organization`, async () => {
        const expectedOrgName = chance.string();
        mockRequest = {
          body: { orgName: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
          ...mockRequest,
        };
        
        findOne.mockReturnValueOnce(false).mockReturnValueOnce(false);
        save.mockRejectedValue(() => new Error('error'));
  
        await setupOrganization(mockRequest as Request, mockResponse as Response);
  
        expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
        expect(defaultNewUser).not.toHaveBeenCalled();
        expect(save).toHaveBeenCalledTimes(1);
        expect(mockResponse.status).toBeCalledWith(500);
        expect(json).toBeCalledWith({ error: 'Failed to setup a new organization' });
      });
  
      it(`should return a 500 if fails to save new admin user`, async () => {
        const expectedOrgName = chance.string();
        mockRequest = {
          body: { orgName: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
          ...mockRequest,
        };
        
        const { orgName, ...params } = mockRequest.body;
        findOne.mockReturnValueOnce(false).mockReturnValueOnce(false);
        save.mockResolvedValueOnce(() => {}).mockRejectedValueOnce(() => new Error('error'));
  
        await setupOrganization(mockRequest as Request, mockResponse as Response);
  
        expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
        expect(defaultNewUser).toHaveBeenCalledWith({ org: defaultNewOrganization.mock.results[0].value, ...params });
        expect(save).toHaveBeenCalledTimes(2);
        expect(mockResponse.status).toBeCalledWith(500);
        expect(json).toBeCalledWith({ error: 'Failed to setup a new organization' });
      });
  
      it(`should return a 200 if setup succeeds`, async () => {
        const expectedOrgName = chance.string();
        mockRequest = {
          body: { orgName: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
          ...mockRequest,
        };
  
        const { orgName, ...params } = mockRequest.body;
        const kmsGenerateEncryptionKey = jest.spyOn(kmsUtil, 'generateEncryptionKey');
        findOne.mockReturnValueOnce(false).mockReturnValueOnce(false);
        save.mockResolvedValueOnce(() => {})
  
        await setupOrganization(mockRequest as Request, mockResponse as Response);
  
        expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
        expect(defaultNewUser).toHaveBeenCalledWith({ org: defaultNewOrganization.mock.results[0].value, ...params });
        expect(kmsGenerateEncryptionKey).toHaveBeenCalled();
        expect(mockResponse.status).toBeCalledWith(200);
        expect(json).toBeCalledWith({});

        kmsGenerateEncryptionKey.mockRestore();
      });
    });
  });

  describe('login', () => {
    afterEach(() => {
      find.mockRestore();
      findOne.mockRestore();
      save.mockRestore();
    });
    
    describe.each([
      { field: 'email', previousObj: {} },
      { field: 'password', previousObj: { email: chance.email() } },
    ])('validate param($field)', ({ field, previousObj }) => {
      it(`should return a 400 error if ${field} does not exist`, async () => {
        mockRequest = {
          body: previousObj,
          ...mockRequest,
        };
        
        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
      });

      if (field === 'email') {
        it(`should return a 400 error if ${field} is not defined`, async () => {
          mockRequest = {
            body: { [field]: null, ...previousObj },
            ...mockRequest,
          };
          
          await login(mockRequest as Request, mockResponse as Response);

          expect(mockResponse.status).toBeCalledWith(400);
          expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
        });

        it(`should return a 400 error if ${field} is not a string`, async () => {
          mockRequest = {
            body: { [field]: 1, ...previousObj },
            ...mockRequest,
          };
          
          await login(mockRequest as Request, mockResponse as Response);

          expect(mockResponse.status).toBeCalledWith(400);
          expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a string value.` });
        });

        it(`should return a 400 error if ${field} is not a valid email string`, async () => {
          mockRequest = {
            body: { [field]: chance.string(), ...previousObj },
            ...mockRequest,
          };
          
          await login(mockRequest as Request, mockResponse as Response);

          expect(mockResponse.status).toBeCalledWith(400);
          expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a valid email identifier.` });
        });
      }
    });

    it(`should return a 403 error if email does not exist`, async () => {
      const expectedEmail = chance.email();
      mockRequest = {
        body: { email: expectedEmail, password: chance.string() },
        ...mockRequest,
      };
      
      findOne.mockReturnValueOnce(false);

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please check that you have provided a valid email and password.' });
    });

    it(`should return a 403 error if user has no password set`, async () => {
      const expectedEmail = chance.email();
      mockRequest = {
        body: { email: expectedEmail, password: chance.string() },
        ...mockRequest,
      };
      
      findOne.mockReturnValueOnce({ pwdHash: null });
      
      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please reset your password.' });
    });

    it(`should return a 403 error if password does not match`, async () => {
      const existingPwdHash = chance.string(),
            expectedPassword = chance.string(),
            expectedEmail = chance.email();
      
      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        ...mockRequest,
      };

      findOne.mockReturnValueOnce({ pwdHash: existingPwdHash });
      mockValue(bcrypt.compare, MockType.Resolve, false);
      
      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please check that you have provided a valid email and password.' });
    });

    it(`should return a 403 error if multiple sessions are not allowed`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();

      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce({ id: expectedUserId, organization: { allowMultipleSessions: false }, pwdHash: existingPwdHash })
      find.mockReturnValueOnce([{ [chance.string()]: chance.string() }]);
      mockValue(bcrypt.compare, MockType.Resolve, true);

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(find).toHaveBeenCalledWith(Session, { where: {
          user: { id: expectedUserId },
          expiresAt: LessThanOrEqual(new Date('2018-05-25T05:00:00.000Z')),
        },
        relations: ['user']
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please logout all existing sessions and try again.' });
    });

    it(`should return a 200 and succcessful login when mfa not enabled and single session`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, organization: { allowMultipleSessions: false, encryptionKey: chance.string(), sessionInterval: '02:00', uniqueId: chance.string() }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('base64');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;
      const expectedSession = {
        organization: expectedUser.organization,
        user: expectedUser,
        uniqueId: expectedRandomStr.toString('base64'),
        mfaState: 'verified',
        createdAt: new Date('2018-05-25T05:00:00.000Z'),
        lastActivityAt: new Date('2018-05-25T05:00:00.000Z'),
        expiresAt: new Date('2018-05-25T07:00:00.000Z'),
        userAgent: expectedUserAgent,
        ip: '208.38.230.51',
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      jest.spyOn(kmsUtil, 'decrypt');
      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce(null);
      mockValue(bcrypt.compare, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedKey);
      mockValue(jsonwebtoken.sign, MockType.Return, expectedToken);

      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        get: jest.fn(),
        ...mockRequest,
      };
      mockResponse = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnValue({ json }),
      };

      mockValue(mockRequest.get, MockType.ReturnOnce, '208.38.230.51', expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(find).toHaveBeenCalledWith(Session, { where: {
          user: { id: expectedUserId },
          expiresAt: LessThanOrEqual(new Date('2018-05-25T05:00:00.000Z')),
        },
        relations: ['user']
      });
      expect(mockRequest.get).toHaveBeenCalledWith('x-forwarded-for');
      expect(mockRequest.get).toHaveBeenCalledWith('User-Agent');
      expect(save).toHaveBeenCalledWith(expectedSession);
      expect(save).toHaveBeenCalledWith({
        organization: expectedUser.organization,
        user: expectedUser,
        session: expectedSession,
        programmatic: false,
        ip: '208.38.230.51',
        userAgent: expectedUserAgent,
        localization: 'en',
        region: expectedIpInfo.region,
        city: expectedIpInfo.city,
        coutryCode: expectedIpInfo.country,
        latitude: expectedIpInfo.latitude,
        longitude: expectedIpInfo.longitude,
        login: new Date('2018-05-25T05:00:00.000Z'),
      });
      expect(save).toHaveBeenCalledWith({
        organization: expectedUser.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'login',
        info: JSON.stringify({ email: expectedEmail }),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedUser.id,
        ip: '208.38.230.51',
        countryCode: expectedIpInfo.country,
      });
      expect(mockResponse.cookie).toHaveBeenCalledWith('o', expectedUser.organization.uniqueId, {
        maxAge: 7200000,
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      });
      expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedUser.organization.encryptionKey);
      expect(jsonwebtoken.sign).toHaveBeenCalledWith({ sessionKey: expectedSession.uniqueId }, expectedKey, {
        expiresIn: 7200,
        issuer: 'mailejoe',
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ token: expectedToken, mfaEnabled: false });
    });

    it(`should return a 200 and succcessful login when mfa not enabled and allow multiple sessions`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('base64');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce([{ [chance.string()]: chance.string() }]);
      mockValue(bcrypt.compare, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedKey);
      mockValue(jsonwebtoken.sign, MockType.Return, expectedToken);

      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        get: jest.fn(),
        ...mockRequest,
      };
      mockResponse = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnValue({ json }),
      };

      mockValue(mockRequest.get, MockType.ReturnOnce, '208.38.230.51', expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedUser.organization.encryptionKey);
      expect(save).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ token: expectedToken, mfaEnabled: false });
    });

    it(`should return a 200 and succcessful login when mfa is enabled and single session`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, mfaEnabled: true, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('base64');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce([{ [chance.string()]: chance.string() }]);
      mockValue(bcrypt.compare, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedKey);
      mockValue(jsonwebtoken.sign, MockType.Return, expectedToken);

      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        get: jest.fn(),
        ...mockRequest,
      };
      mockResponse = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnValue({ json }),
      };

      mockValue(mockRequest.get, MockType.ReturnOnce, '208.38.230.51', expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedUser.organization.encryptionKey);
      expect(save).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ token: expectedToken, mfaEnabled: true });
    });

    it(`should return a 500 when fail to save the session`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, mfaEnabled: false, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('base64');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      save.mockRejectedValue(new Error('error'));
      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce([{ [chance.string()]: chance.string() }]);
      mockValue(bcrypt.compare, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedKey);
      mockValue(jsonwebtoken.sign, MockType.Return, expectedToken);

      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        get: jest.fn(),
        ...mockRequest,
      };
      mockResponse = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnValue({ json }),
      };

      mockValue(mockRequest.get, MockType.ReturnOnce, '208.38.230.51', expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(save).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });
});