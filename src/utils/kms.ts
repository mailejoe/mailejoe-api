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

    return Buffer.from(encryptedBlob.CiphertextBlob).toString('utf8');
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
      CiphertextBlob: Buffer.from(encryptedBlob, 'base64'),
    });

    const decryptedBinaryData = await kmsClient.send(command);

    return Buffer.from(decryptedBinaryData.Plaintext).toString('utf8');
  } catch (err) {
    return null;
  }
};

export const generateEncryptionKey = async (): Promise<string> => {
  if (isDevelopment()) {
    return randomBytes(RANDOM_STR).toString('base64');
  }
  
  try {
    const command = new GenerateDataKeyWithoutPlaintextCommand({
      KeyId: process.env.KMS_KEY_ID,
      KeySpec: 'AES_256',
    });
    const dataKey = await kmsClient.send(command);
    return Buffer.from(dataKey.CiphertextBlob).toString('base64');
  } catch (err) {
    console.error(err);
    return null;
  }
};

export function encryptWithDataKey(key: string, plaintext: string): string {
 let iv = randomBytes(IV_LENGTH);
 let cipher = createCipheriv('aes-256-cbc', Buffer.from(key), iv);
 let encrypted = cipher.update(plaintext);

 encrypted = Buffer.concat([encrypted, cipher.final()]);

 return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptWithDataKey(key: string, encryptedTxt: string): string {
 let textParts = encryptedTxt.split(':');
 let iv = Buffer.from(textParts.shift(), 'hex');
 let encryptedText = Buffer.from(textParts.join(':'), 'hex');
 let decipher = createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
 let decrypted = decipher.update(encryptedText);

 decrypted = Buffer.concat([decrypted, decipher.final()]);

 return decrypted.toString();
}
