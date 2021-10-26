import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';

import { isProduction } from './env';

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION,
});

export const encrypt = async (plaintext: string): Promise<string> => {
  if (!isProduction()) {
    return plaintext;
  }
  
  const input = {
    KeyId: process.env.KMS_KEY_ID,
    Plaintext: Buffer.from(JSON.stringify(plaintext)),
  };
  
  const command = new EncryptCommand(input);
  const encryptedBlob = await kmsClient.send(command);

  const buff = Buffer.from(encryptedBlob.CiphertextBlob);
  return buff.toString('base64');
};

export const decrypt = async (encryptedBlob: string): Promise<string> => {
  if (!isProduction()) {
    return encryptedBlob;
  }
  
  const command = new DecryptCommand({
    CiphertextBlob: Uint8Array.from(atob(encryptedBlob), (v) => v.charCodeAt(0)),
  });
  const decryptedBinaryData = await kmsClient.send(command);

  return String.fromCharCode.apply(null, new Uint16Array(decryptedBinaryData.Plaintext));
};
