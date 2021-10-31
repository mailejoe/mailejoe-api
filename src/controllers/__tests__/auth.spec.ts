import * as bcrypt from 'bcrypt';
import { Chance } from 'chance';
import { Request, Response } from 'express';
import { Settings } from 'luxon';
import * as request from 'supertest';
import { LessThanOrEqual } from 'typeorm';

import { setupOrganization } from '../auth';
import { Organization } from '../../entity/Organization';
import { Session } from '../../entity/Session';
import { User } from '../../entity/User';
import * as ipinfoUtil from '../../utils/ip-info';
import * as kmsUtil from '../../utils/kms';

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
jest.mock('typeorm', () => {
  return {
    ...(jest.requireActual('typeorm')),
    getManager: jest.fn(() => mockEntityManager),
  };
});
jest.mock('../../utils/ip-info');

describe('auth', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
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
        const result = await request(server).post('/setup').send(previousObj);

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field is required.`);
      });

      it(`should return a 400 error if ${field} is not defined`, async () => {
        const result = await request(server).post('/setup').send({ [field]: null, ...previousObj });

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field is required.`);
      });

      it(`should return a 400 error if ${field} is not a string`, async () => {
        const result = await request(server).post('/setup').send({ [field]: 1, ...previousObj });

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field must be a string value.`);
      });

      it(`should return a 400 error if ${field} exceeds the string length limit`, async () => {
        const result = await request(server).post('/setup').send({ [field]: new Array(field !== 'email' ? 300 : 1050).join('a'), ...previousObj });

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field must be between 1 and ${field !== 'email' ? 255 : 1024} characters in length.`);
      });

      if (field === 'email') {
        it(`should return a 400 error if ${field} is not a valid email string`, async () => {
          const result = await request(server).post('/setup').send({ [field]: chance.string(), ...previousObj });
  
          expect(result.statusCode).toBe(400);
          expect(result.body.error).toBe(`The \`${field}\` field must be a valid email identifier.`);
        });
      }
    });

    it(`should return a 400 error if orgName is not unique`, async () => {
      findOne.mockReturnValueOnce(true);
      
      const expectedOrgName = chance.string();
      const result = await request(server).post('/setup').send({ orgName: expectedOrgName, firstName: chance.string(), lastName: chance.string(), email: chance.email() });

      expect(findOne).toHaveBeenCalledWith(Organization, { where: { name: expectedOrgName } });
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toBe('Organization name must be unique');
    });

    it(`should return a 400 error if email is not unique`, async () => {
      findOne.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      const expectedEmail = chance.email();
      const result = await request(server).post('/setup').send({ orgName: chance.string(), firstName: chance.string(), lastName: chance.string(), email: expectedEmail });

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toBe('Email must be unique');
    });

    it(`should return a 500 if fails to save new organization`, async () => {
      const defaultNewOrganization = jest.spyOn(Organization, 'defaultNewOrganization');
      const defaultNewUser = jest.spyOn(User, 'defaultNewUser');
      findOne.mockReturnValueOnce(false).mockReturnValueOnce(false);
      save.mockRejectedValue(() => new Error('error'));

      const expectedOrgName = chance.string();
      const params = { firstName: chance.string(), lastName: chance.string(), email: chance.email() };
      const result = await request(server).post('/setup').send({ orgName: expectedOrgName, ...params });

      expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
      expect(defaultNewUser).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe('Failed to setup a new organization');

      defaultNewOrganization.mockRestore();
      defaultNewUser.mockRestore();
    });

    it(`should return a 500 if fails to save new admin user`, async () => {
      const defaultNewOrganization = jest.spyOn(Organization, 'defaultNewOrganization');
      const defaultNewUser = jest.spyOn(User, 'defaultNewUser');
      findOne.mockReturnValueOnce(false).mockReturnValueOnce(false);
      save.mockResolvedValueOnce(() => {}).mockRejectedValueOnce(() => new Error('error'));

      const expectedOrgName = chance.string();
      const params = { firstName: chance.string(), lastName: chance.string(), email: chance.email() };
      const result = await request(server).post('/setup').send({ orgName: expectedOrgName, ...params });

      expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
      expect(defaultNewUser).toHaveBeenCalledWith({ org: defaultNewOrganization.mock.results[0].value, ...params });
      expect(save).toHaveBeenCalledTimes(2);
      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe('Failed to setup a new organization');

      defaultNewOrganization.mockRestore();
      defaultNewUser.mockRestore();
    });

    it(`should return a 200 if setup succeeds`, async () => {
      const defaultNewOrganization = jest.spyOn(Organization, 'defaultNewOrganization');
      const defaultNewUser = jest.spyOn(User, 'defaultNewUser');
      const kmsGenerateEncryptionKey = jest.spyOn(kmsUtil, 'generateEncryptionKey');
      findOne.mockReturnValueOnce(false).mockReturnValueOnce(false);
      save.mockResolvedValueOnce(() => {})

      const expectedOrgName = chance.string();
      const params = { firstName: chance.string(), lastName: chance.string(), email: chance.email() };
      const result = await request(server).post('/setup').send({ orgName: expectedOrgName, ...params });

      expect(defaultNewOrganization).toHaveBeenCalledWith(expectedOrgName);
      expect(defaultNewUser).toHaveBeenCalledWith({ org: defaultNewOrganization.mock.results[0].value, ...params });
      expect(kmsGenerateEncryptionKey).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.body).toStrictEqual({});

      defaultNewOrganization.mockRestore();
      defaultNewUser.mockRestore();
      kmsGenerateEncryptionKey.mockRestore();
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
        const result = await request(server).post('/login').send(previousObj);

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field is required.`);
      });

      if (field === 'email') {
        it(`should return a 400 error if ${field} is not defined`, async () => {
          const result = await request(server).post('/login').send({ [field]: null, ...previousObj });

          expect(result.statusCode).toBe(400);
          expect(result.body.error).toBe(`The \`${field}\` field is required.`);
        });

        it(`should return a 400 error if ${field} is not a string`, async () => {
          const result = await request(server).post('/login').send({ [field]: 1, ...previousObj });

          expect(result.statusCode).toBe(400);
          expect(result.body.error).toBe(`The \`${field}\` field must be a string value.`);
        });

        it(`should return a 400 error if ${field} is not a valid email string`, async () => {
          const result = await request(server).post('/login').send({ [field]: chance.string(), ...previousObj });
  
          expect(result.statusCode).toBe(400);
          expect(result.body.error).toBe(`The \`${field}\` field must be a valid email identifier.`);
        });
      }
    });

    it(`should return a 403 error if email does not exist`, async () => {
      findOne.mockReturnValueOnce(false);

      const expectedEmail = chance.email();
      const result = await request(server).post('/login').send({ email: expectedEmail, password: chance.string() });

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(result.statusCode).toBe(403);
      expect(result.body.error).toBe('Please check that you have provided a valid email and password.');
    });

    it(`should return a 403 error if user has no password set`, async () => {
      findOne.mockReturnValueOnce({ pwdHash: null });
      
      const expectedEmail = chance.email();
      const result = await request(server).post('/login').send({ email: expectedEmail, password: chance.string() });

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(result.statusCode).toBe(403);
      expect(result.body.error).toBe('Please reset your password.');
    });

    it(`should return a 403 error if password does not match`, async () => {
      const existingPwdHash = chance.string();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      
      findOne.mockReturnValueOnce({ pwdHash: existingPwdHash });
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false);
      
      const result = await request(server).post('/login').send({ email: expectedEmail, password: expectedPassword });

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(result.statusCode).toBe(403);
      expect(result.body.error).toBe('Please check that you have provided a valid email and password.');
    });

    it(`should return a 403 error if multiple sessions are not allowed`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce({ id: expectedUserId, organization: { allowMultipleSessions: false }, pwdHash: existingPwdHash })
      find.mockReturnValueOnce([{ [chance.string()]: chance.string() }]);
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true);

      const result = await request(server).post('/login').send({ email: expectedEmail, password: expectedPassword });

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(find).toHaveBeenCalledWith(Session, { where: {
          user: { id: expectedUserId },
          expiresAt: LessThanOrEqual(new Date('2018-05-25T05:00:00.000Z')),
        },
        relations: ['user']
      });
      expect(result.statusCode).toBe(403);
      expect(result.body.error).toBe('Please logout all existing sessions and try again.');
    });

    it(`should return a 200 and succcessful login when mfa not enabled and single session`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
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

      kmsMock.on(DecryptCommand, { CiphertextBlob: Buffer.from(expectedUser.organization.encryptionKey) })
        .resolves({
          Plaintext: expectedKey,
        });

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      jest.spyOn(kmsUtil, 'decrypt');
      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce(null);
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true);
      (ipinfoUtil.getIPInfo as jest.MockedFunction<typeof ipinfoUtil.getIPInfo>).mockResolvedValue(expectedIpInfo);

      const result = await request(server)
        .post('/login')
        .set('x-forwarded-for', '208.38.230.51')
        .set('User-Agent', expectedUserAgent)
        .set('Accept-Language', 'es')
        .send({ email: expectedEmail, password: expectedPassword });

      expect(findOne).toHaveBeenCalledWith(User, { where: { email: expectedEmail } });
      expect(bcrypt.compare).toHaveBeenCalledWith(expectedPassword, existingPwdHash);
      expect(find).toHaveBeenCalledWith(Session, { where: {
          user: { id: expectedUserId },
          expiresAt: LessThanOrEqual(new Date('2018-05-25T05:00:00.000Z')),
        },
        relations: ['user']
      });
      expect(save).toHaveBeenCalledWith(expectedSession);
      expect(save).toHaveBeenCalledWith({
        organization: expectedUser.organization,
        user: expectedUser,
        session: expectedSession,
        programmatic: false,
        ip: '208.38.230.51',
        userAgent: expectedUserAgent,
        localization: 'es',
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
      expect(kmsUtil.decrypt).toHaveBeenCalledWith(expectedUser.organization.encryptionKey);
      expect(result.statusCode).toBe(200);
      
      const cookie = result.headers['set-cookie'][0];
      expect(cookie).toContain(`o=${encodeURIComponent(expectedUser.organization.uniqueId)};`);
      expect(cookie).toContain('Max-Age=7200;');
      expect(cookie).toContain('Path=/;');
      expect(cookie).toContain('HttpOnly;');
      expect(cookie).toContain('SameSite=Lax');

      kmsMock.reset();
    });

    it(`should return a 200 and succcessful login when mfa not enabled and allow multiple sessions`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedUser = { id: expectedUserId, organization: { allowMultipleSessions: true, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('base64');
      const expectedIpInfo = {
        country: chance.string(),
        region: chance.string(),
        city: chance.string(),
        latitude: chance.floating(),
        longitude: chance.floating(),
      } as ipinfoUtil.IPInfo;

      kmsMock.on(DecryptCommand, { CiphertextBlob: Buffer.from(expectedUser.organization.encryptionKey) })
        .resolves({
          Plaintext: expectedKey,
        });

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce([{ [chance.string()]: chance.string() }]);
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true);
      (ipinfoUtil.getIPInfo as jest.MockedFunction<typeof ipinfoUtil.getIPInfo>).mockResolvedValue(expectedIpInfo);

      const result = await request(server)
        .post('/login')
        .set('x-forwarded-for', '208.38.230.51')
        .set('User-Agent', expectedUserAgent)
        .set('Accept-Language', 'es')
        .send({ email: expectedEmail, password: expectedPassword });

      expect(result.statusCode).toBe(200);
      expect(result.headers['set-cookie'][0]).not.toBeUndefined();
      kmsMock.reset();
    });

    it(`should return a 200 and succcessful login when mfa is enabled and single session`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedUser = { id: expectedUserId, mfaEnabled: true, organization: { allowMultipleSessions: false, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
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
        mfaState: 'unverified',
        createdAt: new Date('2018-05-25T05:00:00.000Z'),
        lastActivityAt: new Date('2018-05-25T05:00:00.000Z'),
        expiresAt: new Date('2018-05-25T07:00:00.000Z'),
        userAgent: expectedUserAgent,
        ip: '208.38.230.51',
      };

      kmsMock.on(DecryptCommand, { CiphertextBlob: Buffer.from(expectedUser.organization.encryptionKey) })
        .resolves({
          Plaintext: expectedKey,
        });

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce(null);
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true);
      (ipinfoUtil.getIPInfo as jest.MockedFunction<typeof ipinfoUtil.getIPInfo>).mockResolvedValue(expectedIpInfo);

      const result = await request(server)
        .post('/login')
        .set('x-forwarded-for', '208.38.230.51')
        .set('User-Agent', expectedUserAgent)
        .set('Accept-Language', 'es')
        .send({ email: expectedEmail, password: expectedPassword });

      expect(result.statusCode).toBe(200);
      expect(result.headers['set-cookie'][0]).not.toBeUndefined();
      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenCalledWith(expectedSession);
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

      kmsMock.reset();
    });

    it(`should return a 500 when fail to save the session`, async () => {
      const existingPwdHash = chance.string();
      const expectedUserId = chance.integer();
      const expectedPassword = chance.string();
      const expectedEmail = chance.email();
      const expectedUserAgent = chance.string();
      const expectedUser = { id: expectedUserId, mfaEnabled: true, organization: { allowMultipleSessions: false, encryptionKey: chance.string(), sessionInterval: '02:00' }, pwdHash: existingPwdHash };
      const expectedKey = chance.string({ length: 64 }).toString('base64');

      kmsMock.on(DecryptCommand, { CiphertextBlob: Buffer.from(expectedUser.organization.encryptionKey) })
        .resolves({
          Plaintext: expectedKey,
        });

      Settings.now = () => new Date(2018, 4, 25).valueOf();

      findOne.mockReturnValueOnce(expectedUser);
      find.mockReturnValueOnce(null);
      save.mockRejectedValue(new Error('error'));
      (bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true);

      const result = await request(server)
        .post('/login')
        .set('x-forwarded-for', '208.38.230.51')
        .set('User-Agent', expectedUserAgent)
        .set('Accept-Language', 'es')
        .send({ email: expectedEmail, password: expectedPassword });

      expect(result.statusCode).toBe(500);

      kmsMock.reset();
    });
  });
});