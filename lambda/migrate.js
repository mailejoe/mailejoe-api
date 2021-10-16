const AWS = require('aws-sdk');
import {
  createConnection
} from 'typeorm';

const retrieveSecrets = async () => {
  const secretsmanager = new AWS.SecretsManager({
    apiVersion: '2017-10-17',
    region: process.env.AWS_REGION,
  });

  const secret = await secretsmanager.getSecretValue({ SecretId: process.env.SECRET_ID }).promise();
  return JSON.parse(secret.SecretString);
};

module.exports.handler = async function handler(event, context, callback) {
  let config = await retrieveSecrets();

  const connection = await createConnection({
    ...config, logging: true
  });

  await connection.runMigrations({
    transaction: false
  });

  await connection.close();

  return callback(null, 'Migrations completed successfully');
};
