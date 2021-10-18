import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';

export const retrieveSecrets = async (): Promise<void> => {
  const client = new SecretsManagerClient({
    apiVersion: '2017-10-17',
    region: process.env.AWS_REGION,
  });

  try {
    const command = new GetSecretValueCommand({
      SecretId: process.env.SECRET_ID,
    });
    const response = await client.send(command);
    const keyValuePairs = JSON.parse(response.SecretString);
    Object.keys(keyValuePairs).forEach(k => {
      process.env[k] = keyValuePairs[k];
    });
  } catch (error) {
    console.error(`Failed to lookup secret: ${process.env.SECRET_ID}`);
  }
};

export const retrieveSecret = async (secret: string): Promise<string|null> => {
  const client = new SecretsManagerClient({
    apiVersion: '2017-10-17',
    region: process.env.AWS_REGION,
  });

  try {
    const command = new GetSecretValueCommand({
      SecretId: secret,
    });
    const response = await client.send(command);
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error(`Failed to lookup secret: ${secret}`);
  }
  

  return null;
};
