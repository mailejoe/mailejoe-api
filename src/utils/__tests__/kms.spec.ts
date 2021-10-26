import {
  decrypt,
  encrypt,
} from '../kms';
import { mockClient } from 'aws-sdk-client-mock';
import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
import { Chance } from 'chance';

const kmsMock = mockClient(KMSClient);
const chance = new Chance();

describe('kms manager helper', () => {
  describe('decrypt', () => {
    test('random', async () => {
      expect(1).toBe(1);
    });
  });

  describe('encrypt', () => {
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