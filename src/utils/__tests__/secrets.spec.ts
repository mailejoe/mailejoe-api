import {
  retrieveSecrets,
  retrieveSecret,
} from '../secrets';
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Chance } from 'chance';

const smMock = mockClient(SecretsManagerClient);
const chance = new Chance();

describe('secrets manager helper', () => {
  const OLD_ENV = process.env;
  
  afterAll(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });
  
  describe('retrieveSecrets', () => {
    it('should successfully place fields from secret onto process.env', async () => {
      process.env.SECRET_ID = chance.string();
      const expectedData = {
        'test1': chance.string(),
        'test2': chance.string()
      };
      smMock.on(GetSecretValueCommand, { SecretId: process.env.SECRET_ID })
        .resolves({
          SecretString: JSON.stringify(expectedData),
        });
      await retrieveSecrets();
      expect(process.env.test1).toBe(expectedData.test1);
      expect(process.env.test2).toBe(expectedData.test2);
    });

    /*it('should return null if the secrets lookup fails', async () => {
      const expectedSecretId = chance.string();
      smMock.on(GetSecretValueCommand, { SecretId: expectedSecretId }).rejects();
      const response = await retrieveSecret(expectedSecretId);
      expect(response).toBe(null);
    });*/
  });

  describe('retrieveSecret', () => {
    it('should return the string as a JSON parsed secret value', async () => {
      const expectedSecretId = chance.string();
      const expectedString = chance.string();
      smMock.on(GetSecretValueCommand, { SecretId: expectedSecretId })
        .resolves({
          SecretString: JSON.stringify(expectedString),
        });
      const response = await retrieveSecret(expectedSecretId);
      expect(response).toBe(expectedString);
    });

    it('should return the object as a JSON parsed secret value', async () => {
      const expectedSecretId = chance.string();
      const expectedObject = { [chance.string()]: chance.string() };
      smMock.on(GetSecretValueCommand, { SecretId: expectedSecretId })
        .resolves({
          SecretString: JSON.stringify(expectedObject),
        });
      const response = await retrieveSecret(expectedSecretId);
      expect(response).toStrictEqual(expectedObject);
    });

    it('should return null if the secrets lookup fails', async () => {
      const expectedSecretId = chance.string();
      smMock.on(GetSecretValueCommand, { SecretId: expectedSecretId }).rejects();
      const response = await retrieveSecret(expectedSecretId);
      expect(response).toBe(null);
    });
  });
});