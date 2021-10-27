import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION,
});

export const retrieveSecrets = async (): Promise<void> => {
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
    console.log(`Failed to lookup secret: ${process.env.SECRET_ID}`);
  }
};

export const retrieveSecret = async (secret: string): Promise<string|null> => {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secret,
    });
    const response = await client.send(command);
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.log(`Failed to lookup secret: ${secret}`);
  }

  return null;
};
