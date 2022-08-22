import {
  KMSClient,
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyWithoutPlaintextCommand,
} from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { isDevelopment } from './env';

const RANDOM_STR = 128;
const IV_LENGTH = 16;
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION,
});

export const encrypt = async (plaintext: string): Promise<string> => {
  if (isDevelopment()) {
    return plaintext;
  }
  
  try {
    const input = {
      KeyId: process.env.KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext),
    };

    const command = new EncryptCommand(input);
    const encryptedBlob = await kmsClient.send(command);

    return Buffer.from(encryptedBlob.CiphertextBlob).toString('hex');
  } catch (err) {
    return null;
  }
};

export const decrypt = async (encryptedBlob: string): Promise<string> => {
  if (isDevelopment()) {
    return encryptedBlob;
  }
  
  try {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedBlob, 'hex'),
    });

    const decryptedBinaryData = await kmsClient.send(command);

    return Buffer.from(decryptedBinaryData.Plaintext).toString('hex');
  } catch (err) {
    return null;
  }
};

export const generateEncryptionKey = async (): Promise<string> => {
  if (isDevelopment()) {
    return randomBytes(RANDOM_STR).toString('hex');
  }
  
  try {
    const command = new GenerateDataKeyWithoutPlaintextCommand({
      KeyId: process.env.KMS_KEY_ID,
      KeySpec: 'AES_256',
    });
    const dataKey = await kmsClient.send(command);

    return Buffer.from(dataKey.CiphertextBlob).toString('hex');
  } catch (err) {
    console.error(err);
    return null;
  }
};

export function encryptWithDataKey(key: string, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(plaintext);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptWithDataKey(key: string, encryptedTxt: string): string {
  const textParts = encryptedTxt.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.shift(), 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}
