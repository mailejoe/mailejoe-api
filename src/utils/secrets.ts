import { SecretsManager } from 'aws-sdk';

const secretsmanager = new SecretsManager({
  apiVersion: '2017-10-17',
  region: process.env.AWS_REGION,
});

export const retrieveSecrets = async (): Promise<void> => {
  const secret = await secretsmanager.getSecretValue({ SecretId: process.env.SECRET_ID }).promise();
  const keyValuePairs = JSON.parse(secret.SecretString);
  Object.keys(keyValuePairs).forEach(k => {
    process.env[k] = keyValuePairs[k];
  });
};

export const retrieveSecret = async (secret: string): Promise<string> => {
  const secretObj = await secretsmanager.getSecretValue({ SecretId: secret }).promise();
  return secretObj.SecretString;
};
