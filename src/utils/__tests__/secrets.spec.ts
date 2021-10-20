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
  describe('retrieveSecrets', () => {
    test('random', async () => {
      expect(1).toBe(1);
    });
  });

  describe('retrieveSecret', () => {
    it('should return the string as a JSON parsed secret value', async () => {
      const expectedString = chance.string();
      smMock.on(GetSecretValueCommand)
        .resolves({
          SecretString: JSON.stringify(expectedString),
        });
      const response = await retrieveSecret(chance.string());
      expect(response).toBe(expectedString);
    });

    it('should return the object as a JSON parsed secret value', async () => {
      const expectedObject = { [chance.string()]: chance.string() };
      smMock.on(GetSecretValueCommand)
        .resolves({
          SecretString: JSON.stringify(expectedObject),
        });
      const response = await retrieveSecret(chance.string());
      expect(response).toStrictEqual(expectedObject);
    });

    it('should return null if the secrets lookup fails', async () => {
      smMock.on(GetSecretValueCommand).rejects();
      const response = await retrieveSecret(chance.string());
      expect(response).toBe(null);
    });
  });
});