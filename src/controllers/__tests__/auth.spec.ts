import * as bcrypt from 'bcrypt';
import { Chance } from 'chance';
import { Request, Response } from 'express';
import { __, configure } from 'i18n';
import * as jsonwebtoken from 'jsonwebtoken';
import { Settings } from 'luxon';
import * as qrcode from 'qrcode';
import { join } from 'path';
import { generateSecret, totp } from 'speakeasy';
import { MoreThan, LessThanOrEqual } from 'typeorm';

import {
  currentAccount,
  login,
  mfa,
  passwordResetRequest,
  passwordReset,
  setupMfa,
  setupOrganization,
} from '../auth';
import { permissions } from '../../constants/permissions';
import * as db from '../../database';
import { Organization } from '../../entity/Organization';
import { Role } from '../../entity/Role';
import { Session } from '../../entity/Session';
import { User } from '../../entity/User';
import { UserPwdHistory } from '../../entity/UserPwdHistory';
import * as ipinfoUtil from '../../utils/ip-info';
import * as kmsUtil from '../../utils/kms';
import * as sesUtil from '../../utils/ses';

import { MockType, mockValue, mockRestore } from '../../testing';

const chance = new Chance();
const findOne = jest.fn();
const find = jest.fn();
const save = jest.fn();
const update = jest.fn();
const mockEntityManager = { find, findOne, save, update };
const expectedRandomStr = chance.string();

jest.mock('bcrypt');
jest.mock('crypto', () => {
  return {
    ...(jest.requireActual('crypto')),
    randomBytes: jest.fn(() => expectedRandomStr),
  };
});
jest.mock('jsonwebtoken');
jest.mock('qrcode');
jest.mock('speakeasy');
jest.mock('../../database');
jest.mock('../../utils/ip-info');
jest.mock('../../utils/kms');
jest.mock('../../utils/ses');

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
  let json = jest.fn();
  let end = jest.fn();
  
  beforeAll(() => {
    mockValue(db.getDataSource, MockType.Return, { manager: mockEntityManager });
  });

  afterAll(async () => {
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

  describe('setupOrganization', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(save);
    });
    
    describe.each([
      { field: 'name', previousObj: {} },
      { field: 'firstName', previousObj: { name: chance.string() } },
      { field: 'lastName', previousObj: { name: chance.string(), firstName: chance.string() } },
      { field: 'email', previousObj: { name: chance.string(), firstName: chance.string(), lastName: chance.string() } },
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

    it('should return a 400 error if name is not unique', async () => {
      const expectedOrgName = chance.string();
      mockRequest = {
        body: { name: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
        ...mockRequest,
      };
      
      mockValue(findOne, MockType.ReturnOnce, true);
      
      await setupOrganization(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(Organization, { where: { name: expectedOrgName } });
      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Organization name must be unique' });
    });

    it('should return a 400 error if email is not unique', async () => {
      const expectedEmail = chance.email();      
      mockRequest = {
        body: { name: chance.string(), firstName: chance.string(), lastName: chance.string(), email: expectedEmail },
        ...mockRequest,
      };

      mockValue(findOne, MockType.ReturnOnce, false, true);

      await setupOrganization(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Email must be unique' });
    });

    describe('org being created', () => {
      let defaultNewOrganization,
          defaultNewUser,
          defaultAdminRole;
      
      beforeAll(() => {
        defaultNewOrganization = jest.spyOn(Organization, 'defaultNewOrganization');
        defaultNewUser = jest.spyOn(User, 'defaultNewUser');
        defaultAdminRole = jest.spyOn(Role, 'defaultAdminRole');
      });

      afterEach(() => {
        defaultNewOrganization.mockClear();
        defaultNewUser.mockClear();
        defaultAdminRole.mockClear();
      });

      it('should return a 500 if fails to save new organization', async () => {
        const expectedOrgName = chance.string();
        mockRequest = {
          body: { name: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
          ...mockRequest,
        };
        
        mockValue(findOne, MockType.ReturnOnce, false, false);
        mockValue(save, MockType.Reject, new Error('error'));

        await setupOrganization(mockRequest as Request, mockResponse as Response);
  
        expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
        expect(defaultNewUser).not.toHaveBeenCalled();
        expect(save).toHaveBeenCalledTimes(1);
        expect(mockResponse.status).toBeCalledWith(500);
        expect(json).toBeCalledWith({ error: 'Failed to setup a new organization' });
      });
  
      it('should return a 204 if setup succeeds', async () => {
        const expectedOrgName = chance.string();
        const expectedEncryptionKey = chance.string();
        const expectedOrg = {
          name: expectedOrgName,
          uniqueId: expectedRandomStr,
          encryptionKey: expectedEncryptionKey.toString('hex'),
          sessionKeyLastRotation: new Date('2018-05-25T05:00:00.000Z'),
          registeredOn: new Date('2018-05-25T05:00:00.000Z'),
          minPwdLen: 12,
          maxPwdLen: null,
          minLowercaseChars: 1,
          minUppercaseChars: 1,
          minNumericChars: 1,
          minSpecialChars: 1,
          specialCharSet: '#$%^&-_*!.?=+',
          selfServicePwdReset: true,
          pwdReused: null,
          maxPwdAge: 30,
          enforceMfa: true,
          trustedCidrs: [],
          sessionInterval: '02:00',
          sessionKeyRotation: 14,
          allowUsernameReminder: true,
          allowMultipleSessions: true,
          bruteForceLimit: 5,
          bruteForceAction: 'block',
        };
        const expectedRole = {
          name: 'Administrator',
          description: 'Full administrative privileges for the organization.',
          organization: expectedOrg,
          archived: false,
        };
        mockRequest = {
          body: { name: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() },
          ...mockRequest,
        };

        Settings.now = () => new Date(2018, 4, 25).valueOf();
  
        const { name, ...params } = mockRequest.body;
        
        mockValue(kmsUtil.generateEncryptionKey, MockType.Resolve, expectedEncryptionKey);
        mockValue(findOne, MockType.ReturnOnce, false, false);
        mockValue(save, MockType.Resolve, {});
        mockValue(sesUtil.sendEmail, MockType.Resolve, true);
  
        await setupOrganization(mockRequest as Request, mockResponse as Response);

        expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
        expect(defaultNewUser).toHaveBeenCalledWith({ org: defaultNewOrganization.mock.results[0].value, ...params });
        expect(defaultAdminRole).toHaveBeenCalledWith(__, mockRequest.locale);
        expect(save).toHaveBeenCalledTimes(3 + permissions.length);        
        expect(save).toHaveBeenCalledWith(expectedOrg);        
        expect(save).toHaveBeenCalledWith(expectedRole);
        permissions.forEach((p) => {
          expect(save).toHaveBeenCalledWith({
            role: expectedRole,
            permission: p.name,
          });
        });
        expect(save).toHaveBeenCalledWith({
          organization: expectedOrg,
          email: mockRequest.body.email,
          role: expectedRole,
          firstName: mockRequest.body.firstName,
          lastName: mockRequest.body.lastName,
          pwdHash: null,
          mfaSecret: null,
          mfaEnabled: false,
          archived: false,
          resetToken: expectedRandomStr.toString('hex'),
          tokenExpiration: new Date('2018-05-28T05:00:00.000Z'),
        });
        expect(kmsUtil.generateEncryptionKey).toHaveBeenCalled();
        expect(sesUtil.sendEmail).toHaveBeenCalled();
        expect(mockResponse.status).toBeCalledWith(204);
        expect(end).toHaveBeenCalled();

        mockRestore(kmsUtil.generateEncryptionKey);
        mockRestore(sesUtil.sendEmail);
      });
    });
  });

  describe('login', () => {
    afterEach(() => {
      mockRestore(find);
      mockRestore(findOne);
      mockRestore(save);
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

    it('should return a 403 error if email does not exist', async () => {
      const expectedEmail = chance.email();
      mockRequest = {
        body: { email: expectedEmail, password: chance.string() },
        ...mockRequest,
      };
      
      mockValue(findOne, MockType.ReturnOnce, false);

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        select: {
          id: true,
          mfaEnabled: true,
          organization: {
            allowMultipleSessions: true,
            encryptionKey: true,
            id: true,
            sessionInterval: true,
            uniqueId: true,
          },
          pwdHash: true,
        },
        where: { email: expectedEmail },
        relations: {
          organization: true,
        }
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please check that you have provided a valid email and password.' });
    });

    it('should return a 403 error if user has no password set', async () => {
      const expectedEmail = chance.email();
      mockRequest = {
        body: { email: expectedEmail, password: chance.string() },
        ...mockRequest,
      };
      
      mockValue(findOne, MockType.ReturnOnce, { pwdHash: null });

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        select: {
          id: true,
          mfaEnabled: true,
          organization: {
            allowMultipleSessions: true,
            encryptionKey: true,
            id: true,
            sessionInterval: true,
            uniqueId: true,
          },
          pwdHash: true,
        },
        where: { email: expectedEmail },
        relations: {
          organization: true,
        }
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please reset your password.' });
    });

    it('should return a 403 error if password does not match', async () => {
      const existingPwdHash = chance.string(),
            expectedPassword = chance.string(),
            expectedEmail = chance.email();
      
      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        ...mockRequest,
      };

      mockValue(findOne, MockType.ReturnOnce, { pwdHash: existingPwdHash });
      mockValue(bcrypt.compare, MockType.Resolve, false);
      
      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        select: {
          id: true,
          mfaEnabled: true,
          organization: {
            allowMultipleSessions: true,
            encryptionKey: true,
            id: true,
            sessionInterval: true,
            uniqueId: true,
          },
          pwdHash: true,
        },
        where: { email: expectedEmail },
        relations: {
          organization: true,
        }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Please check that you have provided a valid email and password.' });
    });

    it('should return a 403 error if multiple sessions are not allowed', async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();

      mockRequest = {
        body: { email: expectedEmail, password: expectedPassword },
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.ReturnOnce, { id: expectedUserId, organization: { allowMultipleSessions: false }, pwdHash: existingPwdHash });
      mockValue(find, MockType.ReturnOnce, [{ [chance.string()]: chance.string() }]);
      mockValue(bcrypt.compare, MockType.Resolve, true);

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        select: {
          id: true,
          mfaEnabled: true,
          organization: {
            allowMultipleSessions: true,
            encryptionKey: true,
            id: true,
            sessionInterval: true,
            uniqueId: true,
          },
          pwdHash: true,
        },
        where: { email: expectedEmail },
        relations: {
          organization: true,
        }
      });
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

    it('should return a 200 and succcessful login when mfa not enabled and single session', async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, organization: { allowMultipleSessions: false, encryptionKey: chance.string(), sessionInterval: '02:00', uniqueId: chance.string() }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('hex');
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
        uniqueId: expectedRandomStr.toString('hex'),
        mfaState: 'verified',
        createdAt: new Date('2018-05-25T05:00:00.000Z'),
        lastActivityAt: new Date('2018-05-25T05:00:00.000Z'),
        expiresAt: new Date('2018-05-25T07:00:00.000Z'),
        userAgent: expectedUserAgent,
        ip: '208.38.230.51',
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      jest.spyOn(kmsUtil, 'decrypt');
      mockValue(findOne, MockType.ReturnOnce, expectedUser);
      mockValue(find, MockType.ReturnOnce, null);
      mockValue(bcrypt.compare, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(ipinfoUtil.getIP, MockType.Return, '208.38.230.51');
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

      mockValue(mockRequest.get, MockType.Return, expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        select: {
          id: true,
          mfaEnabled: true,
          organization: {
            allowMultipleSessions: true,
            encryptionKey: true,
            id: true,
            sessionInterval: true,
            uniqueId: true,
          },
          pwdHash: true,
        },
        where: { email: expectedEmail },
        relations: {
          organization: true,
        }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(find).toHaveBeenCalledWith(Session, { where: {
          user: { id: expectedUserId },
          expiresAt: LessThanOrEqual(new Date('2018-05-25T05:00:00.000Z')),
        },
        relations: ['user']
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
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
        countryCode: expectedIpInfo.country,
        latitude: expectedIpInfo.latitude,
        longitude: expectedIpInfo.longitude,
        login: new Date('2018-05-25T05:00:00.000Z'),
      });
      expect(save).toHaveBeenCalledWith({
        organization: expectedUser.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'Login',
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

    it('should return a 200 and succcessful login when mfa not enabled and allow multiple sessions', async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('hex');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.ReturnOnce, expectedUser);
      mockValue(find, MockType.ReturnOnce, [{ [chance.string()]: chance.string() }]);
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

      mockValue(mockRequest.get, MockType.Return, expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedUser.organization.encryptionKey);
      expect(save).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ token: expectedToken, mfaEnabled: false });
    });

    it('should return a 200 and succcessful login when mfa is enabled and single session', async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, mfaEnabled: true, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('hex');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.ReturnOnce, expectedUser);
      mockValue(find, MockType.ReturnOnce, [{ [chance.string()]: chance.string() }]);
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

      mockValue(mockRequest.get, MockType.Return, expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedUser.organization.encryptionKey);
      expect(save).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ token: expectedToken, mfaEnabled: true });
    });

    it('should return a 500 when fail to save the session', async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedToken = chance.string();
      const expectedUser = { id: expectedUserId, mfaEnabled: false, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('hex');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(save, MockType.Reject, new Error('error'));
      mockValue(findOne, MockType.ReturnOnce, expectedUser);
      mockValue(find, MockType.ReturnOnce, [{ [chance.string()]: chance.string() }]);
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

      mockValue(mockRequest.get, MockType.Return, expectedUserAgent);

      await login(mockRequest as Request, mockResponse as Response);

      expect(save).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });

  describe('mfa', () => {
    afterEach(() => {
      save.mockRestore();
    });
    
    describe.each([
      { field: 'token', previousObj: {} },
    ])('validate param($field)', ({ field, previousObj }) => {
      it(`should return a 400 error if ${field} does not exist`, async () => {
        mockRequest = {
          body: previousObj,
          ...mockRequest,
        };
        
        await mfa(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
      });

      it(`should return a 400 error if ${field} is not a string`, async () => {
        mockRequest = {
          body: { [field]: 1, ...previousObj },
          ...mockRequest,
        };
        
        await mfa(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a string value.` });
      });
    });

    it('should return a 403 error if session does not exist', async () => {
      mockRequest = {
        body: { token: chance.string() },
        ...mockRequest,
      };
      
      await mfa(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Unauthorized' });
    });

    it('should return a 403 error if user does not have mfa configured yet', async () => {
      mockRequest = {
        body: { token: chance.string() },
        session: { user: {} },
        ...mockRequest,
      };
      
      await mfa(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ mfaSetup: true });
    });

    it('should return a 403 error if token is not valid', async () => {
      const expectedEncryptionKey = chance.string();
      const expectedMfaSecret = chance.string();
      mockRequest = {
        body: { token: chance.string() },
        session: {
          user: {
            mfaSecret: expectedMfaSecret,
            organization: {
              encryptionKey: chance.string(),
            }
          }
        },
        ...mockRequest,
      };

      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
      mockValue(kmsUtil.decryptWithDataKey, MockType.Return, expectedMfaSecret);
      mockValue(totp.verify, MockType.Return, false);
      
      await mfa(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(mockRequest.session.user.organization.encryptionKey);
      expect(kmsUtil.decryptWithDataKey).toHaveBeenCalledWith(expectedEncryptionKey, expectedMfaSecret);
      expect(totp.verify).toHaveBeenCalledWith({
        secret: expectedMfaSecret,
        encoding: 'base32',
        token: mockRequest.body.token,
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Token provided is not valid.' });

      mockRestore(kmsUtil.decrypt);
      mockRestore(kmsUtil.decryptWithDataKey);
      mockRestore(totp.verify);
    });

    it('should return a 204 and successfully update the users session if token is valid', async () => {
      const expectedEncryptionKey = chance.string();
      const expectedMfaSecret = chance.string();
      const expectedIP = chance.ip();
      const expectedUserAgent = chance.string();
      const expectedIpInfo = {
        region: chance.string(),
        city: chance.string(),
        country: chance.string(),
        latitude: chance.integer(),
        longitude: chance.integer(),
      };
      mockRequest = {
        body: { token: chance.string() },
        locale: 'en',
        session: {
          user: {
            id: chance.string(),
            mfaSecret: expectedMfaSecret,
            organization: {
              encryptionKey: chance.string(),
            }
          },
        },
        get: jest.fn(),
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
      mockValue(kmsUtil.decryptWithDataKey, MockType.Return, expectedMfaSecret);
      mockValue(totp.verify, MockType.Return, true);
      mockValue(save, MockType.Resolve, true);
      mockValue(ipinfoUtil.getIP, MockType.Return, expectedIP);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(mockRequest.get, MockType.Return, expectedUserAgent);
      
      await mfa(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(mockRequest.session.user.organization.encryptionKey);
      expect(kmsUtil.decryptWithDataKey).toHaveBeenCalledWith(expectedEncryptionKey, expectedMfaSecret);
      expect(totp.verify).toHaveBeenCalledWith({
        secret: expectedMfaSecret,
        encoding: 'base32',
        token: mockRequest.body.token,
      });
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalled();
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        user: mockRequest.session.user,
        session: mockRequest.session,
        programmatic: false,
        ip: expectedIP,
        userAgent: expectedUserAgent,
        localization: 'en',
        region: expectedIpInfo.region,
        city: expectedIpInfo.city,
        countryCode: expectedIpInfo.country,
        latitude: expectedIpInfo.latitude,
        longitude: expectedIpInfo.longitude,
        login: new Date('2018-05-25T05:00:00.000Z'),
      });
      expect(save).toHaveBeenCalledWith({
        organization: mockRequest.session.user.organization,
        entityId: mockRequest.session.user.id,
        entityType: 'user',
        operation: 'Mfa',
        info: JSON.stringify({}),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: mockRequest.session.user.id,
        ip: expectedIP,
        countryCode: expectedIpInfo.country,
      });
      expect(save).toHaveBeenCalledWith({ ...mockRequest.session, mfaState: 'verified', lastActivityAt: new Date('2018-05-25T05:00:00.000Z') });
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(end).toHaveBeenCalled();

      mockRestore(kmsUtil.decrypt);
      mockRestore(kmsUtil.decryptWithDataKey);
      mockRestore(ipinfoUtil.getIP);
      mockRestore(ipinfoUtil.getIPInfo);
      mockRestore(totp.verify);
    });

    it('should return a 500 when a database operation fails', async () => {
      const expectedEncryptionKey = chance.string();
      const expectedMfaSecret = chance.string();
      const expectedIP = chance.ip();
      const expectedUserAgent = chance.string();
      const expectedIpInfo = {
        region: chance.string(),
        city: chance.string(),
        country: chance.string(),
        latitude: chance.integer(),
        longitude: chance.integer(),
      };
      mockRequest = {
        body: { token: chance.string() },
        locale: 'en',
        session: {
          user: {
            id: chance.string(),
            mfaSecret: expectedMfaSecret,
            organization: {
              encryptionKey: chance.string(),
            }
          },
        },
        get: jest.fn(),
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedEncryptionKey);
      mockValue(kmsUtil.decryptWithDataKey, MockType.Return, expectedMfaSecret);
      mockValue(totp.verify, MockType.Return, true);
      mockValue(save, MockType.Reject, true);
      mockValue(ipinfoUtil.getIP, MockType.Return, expectedIP);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(mockRequest.get, MockType.Return, expectedUserAgent);
      
      await mfa(mockRequest as Request, mockResponse as Response);

      expect(kmsUtil.decrypt).toHaveBeenCalledWith(mockRequest.session.user.organization.encryptionKey);
      expect(kmsUtil.decryptWithDataKey).toHaveBeenCalledWith(expectedEncryptionKey, expectedMfaSecret);
      expect(ipinfoUtil.getIP).toHaveBeenCalledWith(mockRequest);
      expect(ipinfoUtil.getIPInfo).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'An internal server error has occurred' });

      mockRestore(kmsUtil.decrypt);
      mockRestore(kmsUtil.decryptWithDataKey);
      mockRestore(ipinfoUtil.getIP);
      mockRestore(ipinfoUtil.getIPInfo);
    });
  });

  describe('password reset request', () => {
    afterEach(() => {
      findOne.mockRestore();
      save.mockRestore();
    });
    
    describe.each([
      { field: 'email', previousObj: {} },
    ])('validate param($field)', ({ field, previousObj }) => {
      it(`should return a 400 error if ${field} does not exist`, async () => {
        mockRequest = {
          body: previousObj,
          ...mockRequest,
        };
        
        await passwordResetRequest(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
      });

      it(`should return a 400 error if ${field} is not a string`, async () => {
        mockRequest = {
          body: { [field]: 1, ...previousObj },
          ...mockRequest,
        };
        
        await passwordResetRequest(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a string value.` });
      });

      it(`should return a 400 error if ${field} is not an email address`, async () => {
        mockRequest = {
          body: { [field]: chance.string(), ...previousObj },
          ...mockRequest,
        };
        
        await passwordResetRequest(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a valid email identifier.` });
      });
    });

    it('should return a 200 when success message if email does not match any user', async () => {
      mockRequest = {
        body: { email: chance.email() },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, false);
      
      await passwordResetRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ message: `A password reset email has been sent. Please click on the link in the email.` });
    });

    it('should return a 200 when user is not allowed to request a password reset', async () => {
      const expectedUser = { organization: { selfServicePwdReset: false } };
      
      mockRequest = {
        body: { email: chance.email() },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, expectedUser);
      
      await passwordResetRequest(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        where: { email: mockRequest.body.email },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organization: {
            id: true,
            selfServicePwdReset: true,
          },
        },
        relations: {
          organization: true,
        },
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ message: `A password reset email has been sent. Please click on the link in the email.` });
    });

    it('should return a 200 and successfully send a password reset email', async () => {
      const expectedIP = chance.ip();
      const expectedIpInfo = {
        region: chance.string(),
        city: chance.string(),
        country: chance.string(),
        latitude: chance.integer(),
        longitude: chance.integer(),
      };
      const expectedResetToken = chance.string();
      const expectedUser = { id: chance.string(), organization: { selfServicePwdReset: true }, firstName: chance.string(), lastName: chance.string() };
      
      mockRequest = {
        body: { email: chance.email() },
        ...mockRequest,
      };

      User.createNewResetToken = jest.fn().mockReturnValue(expectedResetToken);

      mockValue(findOne, MockType.Resolve, expectedUser);
      mockValue(ipinfoUtil.getIP, MockType.Return, expectedIP);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(sesUtil.sendEmail, MockType.Resolve, true);
        
      await passwordResetRequest(mockRequest as Request, mockResponse as Response);

      expect(findOne).toHaveBeenCalledWith(User, {
        where: { email: mockRequest.body.email },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organization: {
            id: true,
            selfServicePwdReset: true,
          },
        },
        relations: {
          organization: true,
        },
      });
      expect(save).toHaveBeenCalledWith({
        organization: expectedUser.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'PasswordResetRequest',
        info: JSON.stringify({}),
        generatedOn:new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedUser.id,
        ip: expectedIP,
        countryCode: expectedIpInfo.country,
      });
      expect(User.createNewResetToken).toHaveBeenCalledWith();
      expect(save).toHaveBeenCalledWith({
        ...expectedUser,
        resetToken: expectedResetToken,
        tokenExpiration: new Date('2018-05-28T05:00:00.000Z'),
      });
      expect(sesUtil.sendEmail).toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ message: `A password reset email has been sent. Please click on the link in the email.` });

      mockRestore(ipinfoUtil.getIP);
      mockRestore(ipinfoUtil.getIPInfo);
      mockRestore(sesUtil.sendEmail);
    });
  });

  describe('password reset', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(find);
      mockRestore(save);
      mockRestore(update);
      mockRestore(sesUtil.sendEmail);
    });
    
    describe.each([
      { field: 'password', previousObj: {} },
    ])('validate param($field)', ({ field, previousObj }) => {
      it(`should return a 400 error if ${field} does not exist`, async () => {
        mockRequest = {
          body: previousObj,
          query: {},
          ...mockRequest,
        };
        
        await passwordReset(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field is required.` });
      });

      it(`should return a 400 error if ${field} is not a string`, async () => {
        mockRequest = {
          body: { [field]: 1, ...previousObj },
          query: {},
          ...mockRequest,
        };

        await passwordReset(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error: `The \`${field}\` field must be a string value.` });
      });
    });

    it('should return a 403 if no token is provided', async () => {
      mockRequest = {
        body: { password: chance.string() },
        query: {},
        ...mockRequest,
      };

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: `Unauthorized` });
    });

    it('should return a 403 if token does not match any existing user', async () => {
      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, false);

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Unauthorized' });
    });

    it('should return a 403 if token has expired', async () => {
      const now = new Date().getTime();
      
      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, { tokenExpiration: new Date(now - 1000) });

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'The token provided has expired, please request a new token.' });
    });

    it('should return a 403 if users organization does not allow self service password reset', async () => {
      const now = new Date().getTime();
      
      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, { organization: { selfServicePwdReset: false }, tokenExpiration: new Date(now + 1000) });

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(mockResponse.status).toBeCalledWith(403);
      expect(json).toBeCalledWith({ error: 'Unauthorized' });
    });

    describe.each([
      { password: chance.string({ length: 300 }), settings: {}, error: 'The `password` field must be between 1 and 255 characters in length.' },
      { password: chance.string({ length: 2 }), settings: { minPwdLen: 5 }, error: 'The `password` field must be between 5 and 255 characters in length.' },
      { password: chance.string({ length: 15 }), settings: { maxPwdLen: 5 }, error: 'The `password` field must be between 1 and 5 characters in length.' },
      { password: 'pASSWORD', settings: { minLowercaseChars: 2 }, error: 'The `password` field must contain at least 2 lowercase characters.' },
      { password: 'passWord', settings: { minUppercaseChars: 2 }, error: 'The `password` field must contain at least 2 uppercase characters.' },
      { password: 'passw0rd', settings: { minNumericChars: 2 }, error: 'The `password` field must contain at least 2 numeric characters.' },
      { password: 'passw!rd', settings: { minSpecialChars: 2, specialCharSet: '#$%^&-_*!.?=+' }, error: 'The `password` field must contain at least 2 special characters from the set `#$%^&-_*!.?=+`.' },
      { password: 'passw!#rd', settings: { minSpecialChars: 2, specialCharSet: '!' }, error: 'The `password` field must contain at least 2 special characters from the set `!`.' },
    ])('validate password', ({ password, settings, error }) => {
      it(`should return a 400 error if password fails ${JSON.stringify(settings)}`, async () => {
        const now = new Date().getTime();
      
        mockRequest = {
          body: { password },
          query: { token: chance.string() },
          ...mockRequest,
        };
        
        mockValue(findOne, MockType.Resolve, { organization: { ...settings, selfServicePwdReset: true }, tokenExpiration: new Date(now + 1000) });

        await passwordReset(mockRequest as Request, mockResponse as Response);

        expect(findOne).toBeCalledWith(User, {
          where: { resetToken: mockRequest.query.token },
          relations: {
            organization: true,
          },
          select: {
            email: true,
            firstName: true,
            id: true,
            lastName: true,
            organization: {
              id: true,
              maxPwdLen: true,
              minLowercaseChars: true,
              minNumericChars: true,
              minPwdLen: true,
              minSpecialChars: true,
              minUppercaseChars: true,
              pwdReused: true,
              selfServicePwdReset: true,
              specialCharSet: true,
            },
          },
        });
        expect(mockResponse.status).toBeCalledWith(400);
        expect(json).toBeCalledWith({ error });
      });
    });

    it('should return a 200 and successfully update the password', async () => {
      const now = new Date().getTime();
      const expectedUser = { id: chance.string(), organization: { pwdReused: null, selfServicePwdReset: true }, pwdHash: chance.string(), tokenExpiration: new Date(now + 1000) };
      const expectedPwdHash = chance.string();
      const expectedIP = chance.ip();
      const expectedIpInfo = {
        region: chance.string(),
        city: chance.string(),
        country: chance.string(),
        latitude: chance.integer(),
        longitude: chance.integer(),
      };

      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.Resolve, expectedUser);
      mockValue(bcrypt.hash, MockType.Resolve, expectedPwdHash);
      mockValue(ipinfoUtil.getIP, MockType.Return, expectedIP);
      mockValue(ipinfoUtil.getIPInfo, MockType.Resolve, expectedIpInfo);
      mockValue(sesUtil.sendEmail, MockType.Resolve, true);

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(bcrypt.hash).toBeCalledWith(mockRequest.body.password, 10);
      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toBeCalledWith({
        organization: expectedUser.organization,
        user: expectedUser,
        pwd: expectedPwdHash,
        lastUsedOn: new Date('2018-05-25T05:00:00.000Z'),
      });
      expect(save).toBeCalledWith({
        organization: expectedUser.organization,
        entityId: expectedUser.id,
        entityType: 'user',
        operation: 'PasswordReset',
        info: JSON.stringify({}),
        generatedOn: new Date('2018-05-25T05:00:00.000Z'),
        generatedBy: expectedUser.id,
        ip: expectedIP,
        countryCode: expectedIpInfo.country,
      });
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toBeCalledWith(User, { id: expectedUser.id }, {
        pwdHash: expectedPwdHash,
        resetToken: null,
        tokenExpiration: null,
      });
      expect(update).toBeCalledWith(Session, { user: expectedUser, expiresAt: MoreThan(new Date('2018-05-25T05:00:00.000Z')) }, {
        expiresAt: new Date('2018-05-25T05:00:00.000Z'),
      });
      expect(sesUtil.sendEmail).toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ message: 'Your password has been successfully updated.' });

      mockRestore(bcrypt.hash);
    });

    it ('should return a 200 if password reuse is being enforced but no existing old passwords', async () => {
      const now = new Date().getTime();
      const expectedUser = { id: chance.string(), organization: { pwdReused: 1, selfServicePwdReset: true }, pwdHash: chance.string(), tokenExpiration: new Date(now + 1000) };
      const expectedPwdHash = chance.string();

      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.Resolve, expectedUser);
      mockValue(find, MockType.Resolve, []);
      mockValue(bcrypt.hash, MockType.Resolve, expectedPwdHash);

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(find).toBeCalledWith(UserPwdHistory, {
        where: { user: { id: expectedUser.id } },
        order: {
          lastUsedOn: 'DESC',
        },
        take: expectedUser.organization.pwdReused,
      });
      expect(bcrypt.hash).toBeCalledWith(mockRequest.body.password, 10);
      expect(save).toHaveBeenCalled();
      expect(update).toHaveBeenCalled();
      expect(sesUtil.sendEmail).toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ message: 'Your password has been successfully updated.' });

      mockRestore(bcrypt.hash);
    });

    it('should return a 200 if password reuse is being enforced and existing passwords do not match', async () => {
      const now = new Date().getTime();
      const expectedUser = { id: chance.string(), organization: { pwdReused: 3, selfServicePwdReset: true }, pwdHash: chance.string(), tokenExpiration: new Date(now + 1000) };
      const expectedPwdHash = chance.string();
      const expectedPrevHashes = [
        { pwd: chance.string() },
        { pwd: chance.string() },
        { pwd: chance.string() },
      ];

      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.Resolve, expectedUser);
      mockValue(find, MockType.Resolve, expectedPrevHashes);
      mockValue(bcrypt.hash, MockType.Resolve, expectedPwdHash);
      mockValue(bcrypt.compare, MockType.Return, false);

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(find).toBeCalledWith(UserPwdHistory, {
        where: { user: { id: expectedUser.id } },
        order: {
          lastUsedOn: 'DESC',
        },
        take: expectedUser.organization.pwdReused,
      });
      expect(bcrypt.hash).toBeCalledWith(mockRequest.body.password, 10);
      expectedPrevHashes.forEach(p => {
        expect(bcrypt.compare).toBeCalledWith(mockRequest.body.password, p.pwd);
      });
      expect(save).toHaveBeenCalled();
      expect(update).toHaveBeenCalled();
      expect(sesUtil.sendEmail).toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ message: 'Your password has been successfully updated.' });

      mockRestore(bcrypt.hash);
      mockRestore(bcrypt.compare);
    });

    it('should return a 400 if password reuse is being enforced and old matching password exists', async () => {
      const now = new Date().getTime();
      const expectedUser = { id: chance.string(), organization: { pwdReused: 10, selfServicePwdReset: true }, pwdHash: chance.string(), tokenExpiration: new Date(now + 1000) };
      const expectedPwdHash = chance.string();
      const expectedPrevHashes = [
        { pwd: chance.string() },
        { pwd: chance.string() },
        { pwd: chance.string() },
        { pwd: expectedPwdHash }
      ];

      mockRequest = {
        body: { password: chance.string() },
        query: { token: chance.string() },
        ...mockRequest,
      };

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      mockValue(findOne, MockType.Resolve, expectedUser);
      mockValue(find, MockType.Resolve, expectedPrevHashes);
      mockValue(bcrypt.hash, MockType.Resolve, expectedPwdHash);
      mockValue(bcrypt.compare, MockType.ReturnOnce, false, false, false, true);

      await passwordReset(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { resetToken: mockRequest.query.token },
        relations: {
          organization: true,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          organization: {
            id: true,
            maxPwdLen: true,
            minLowercaseChars: true,
            minNumericChars: true,
            minPwdLen: true,
            minSpecialChars: true,
            minUppercaseChars: true,
            pwdReused: true,
            selfServicePwdReset: true,
            specialCharSet: true,
          },
        },
      });
      expect(find).toBeCalledWith(UserPwdHistory, {
        where: { user: { id: expectedUser.id } },
        order: {
          lastUsedOn: 'DESC',
        },
        take: expectedUser.organization.pwdReused,
      });
      expect(bcrypt.hash).toBeCalledWith(mockRequest.body.password, 10);
      expectedPrevHashes.forEach(p => {
        expect(bcrypt.compare).toBeCalledWith(mockRequest.body.password, p.pwd);
      });
      expect(save).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(sesUtil.sendEmail).not.toHaveBeenCalled();
      expect(mockResponse.status).toBeCalledWith(400);
      expect(json).toBeCalledWith({ error: 'Password must not match a password you have used previously.' });

      mockRestore(bcrypt.hash);
      mockRestore(bcrypt.compare);
    });
  });

  describe('current account', () => {
    afterEach(() => {
      mockRestore(findOne);
    });

    it('should return a 200 and user data', async () => {
      const expectedUser = {
        [chance.string({ symbols: false })]: chance.string(),
      };
      
      mockRequest = {
        session: { user: { id: chance.string() } },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, expectedUser);
      
      await currentAccount(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { id: mockRequest.session.user.id },
        relations: {
          organization: true,
        },
      });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith(expectedUser);
    });

    it('should return a 500 if an server error occurs', async () => {      
      mockRequest = {
        session: { user: { id: chance.string() } },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Reject, false);
      
      await currentAccount(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        where: { id: mockRequest.session.user.id },
        relations: {
          organization: true,
        },
      });
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });

  });

  describe('setup mfa', () => {
    afterEach(() => {
      mockRestore(findOne);
      mockRestore(update);
    });

    it ('should return 200 with qrcode and secret', async () => {
      const expectedUser = {
        id: chance.string(),
        firstName: chance.string(),
        lastName: chance.string(),
        organization: {
          id: chance.string(),
          encryptionKey: chance.string(),
        }
      };
      const expectedSecret = { base32: chance.string(), otpauth_url: chance.string() };
      const expectedDecryptedKey = chance.string();
      const expectedEncryptedSecret = chance.string();
      const expectedQrCode = chance.string();
      
      mockRequest = {
        session: { user: { id: chance.string() } },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Resolve, expectedUser);
      mockValue(generateSecret, MockType.Return, expectedSecret);
      mockValue(kmsUtil.decrypt, MockType.Resolve, expectedDecryptedKey);
      mockValue(kmsUtil.encryptWithDataKey, MockType.Return, expectedEncryptedSecret);
      mockValue(qrcode.toDataURL, MockType.Resolve, expectedQrCode);
      
      await setupMfa(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organization: {
            id: true,
            encryptionKey: true,
          },
        },
        where: { id: mockRequest.session.user.id },
        relations: {
          organization: true,
        }
      });
      expect(generateSecret).toBeCalledWith({ name: `Mailejoe ${expectedUser.firstName}.${expectedUser.lastName}` });
      expect(kmsUtil.decrypt).toBeCalledWith(expectedUser.organization.encryptionKey);
      expect(kmsUtil.encryptWithDataKey).toBeCalledWith(expectedDecryptedKey, expectedSecret.base32);
      expect(qrcode.toDataURL).toBeCalledWith(expectedSecret.otpauth_url);
      expect(update).toBeCalledWith(User, { id: expectedUser.id }, { mfaSecret: expectedEncryptedSecret });
      expect(mockResponse.status).toBeCalledWith(200);
      expect(json).toBeCalledWith({ qrcode: expectedQrCode, code: expectedSecret.base32 });

      mockRestore(kmsUtil.decrypt);
      mockRestore(kmsUtil.encryptWithDataKey);
    });

    it ('should return 500 with error on internal server error', async () => {
      mockRequest = {
        session: { user: { id: chance.string() } },
        ...mockRequest,
      };

      mockValue(findOne, MockType.Reject, false);
      
      await setupMfa(mockRequest as Request, mockResponse as Response);

      expect(findOne).toBeCalledWith(User, {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organization: {
            id: true,
            encryptionKey: true,
          },
        },
        where: { id: mockRequest.session.user.id },
        relations: {
          organization: true,
        }
      });
      expect(mockResponse.status).toBeCalledWith(500);
      expect(json).toBeCalledWith({ error: 'An internal server error has occurred' });
    });
  });
});