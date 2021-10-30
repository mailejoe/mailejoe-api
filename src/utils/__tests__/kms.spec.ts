import {
  KMSClient,
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyWithoutPlaintextCommand,
} from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import { Chance } from 'chance';

import {
  decrypt,
  encrypt,
  generateEncryptionKey,
} from '../kms';

const kmsMock = mockClient(KMSClient);
const chance = new Chance();
const expectedRandomStr = chance.string();

jest.mock('crypto', () => {
  return {
    ...(jest.requireActual('crypto')),
    randomBytes: jest.fn(() => expectedRandomStr),
  };
});

describe('kms manager helper', () => {
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

  describe('decrypt', () => {
    it('should return the input if development environment', async () => {
      process.env.NODE_ENV = 'dev';
      expect(await decrypt('test')).toBe('test');
    });
    
    it('should return the decrypted string', async () => {
      const expectedString = chance.string().toString('base64');
      kmsMock.on(DecryptCommand, { CiphertextBlob: Buffer.from(expectedString, 'base64') })
        .resolves({
          Plaintext: expectedString,
        });
      const response = await decrypt(expectedString);
      expect(response).toBe(expectedString);
    });

    it('should return null if the decryption fails', async () => {
      kmsMock.on(DecryptCommand).rejects(new Error('error'));
      const response = await decrypt(chance.string());
      expect(response).toBe(null);
    });
  });

  describe('encrypt', () => {
    it('should return the input if development environment', async () => {
      process.env.NODE_ENV = 'dev';
      expect(await encrypt('test')).toBe('test');
    });
    
    it('should return the encrypted string', async () => {
      const expectedString = chance.string();
      process.env.KMS_KEY_ID = chance.string();
      kmsMock.on(EncryptCommand, {
          KeyId: process.env.KMS_KEY_ID,
          Plaintext: Buffer.from(expectedString),
        })
        .resolves({
          CiphertextBlob: Buffer.from(expectedString, 'utf8'),
        });
      const response = await encrypt(expectedString);
      expect(response).toBe(expectedString);
    });

    it('should return null if the encryption fails', async () => {
      kmsMock.on(EncryptCommand).rejects(new Error('error'));
      const response = await encrypt(chance.string());
      expect(response).toBe(null);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should return the input if development environment', async () => {
      process.env.NODE_ENV = 'dev';
      expect(await generateEncryptionKey()).toBe(expectedRandomStr.toString('base64'));
    });
    
    it('should return a new encrypted data key', async () => {
      const expectedString = chance.string();
      process.env.KMS_KEY_ID = chance.string();
      kmsMock.on(GenerateDataKeyWithoutPlaintextCommand, {
          KeyId: process.env.KMS_KEY_ID,
          KeySpec: 'AES_256',
        })
        .resolves({
          CiphertextBlob: Buffer.from(expectedString),
        });
      const response = await generateEncryptionKey();
      expect(response).toBe(Buffer.from(expectedString).toString('base64'));
    });

    it('should return null if the encryption fails', async () => {
      kmsMock.on(GenerateDataKeyWithoutPlaintextCommand).rejects(new Error('error'));
      const response = await generateEncryptionKey();
      expect(response).toBe(null);
    });
  });
});