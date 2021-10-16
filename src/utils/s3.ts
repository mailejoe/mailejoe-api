import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';

const s3 = new S3({
  apiVersion: '2006-03-01',
  region: process.env.AWS_REGION,
});

export const getSignedUrl = async (key: string): Promise<string> => {
  if (!key) {
    return ''; // persist a fallback image?
  }

  const params = { Bucket: process.env.GH_BUCKET, Key: key };
  return s3.getSignedUrlPromise('getObject', params);
};

export const uploadFile = async (filename: string, filepath: string, type?: string): Promise<any> => {
  if (!filename) {
    return;
  }

  const params = {
    Bucket: process.env.GH_BUCKET,
    Key: `uploads/${filename}`,
    Body: createReadStream(filepath),
    ServerSideEncryption: 'AES256',
    StorageClass: 'STANDARD_IA',
    ...(type && { ContentType: type })
  };

  return new Promise((resolve, reject) => {
    s3.putObject(params, (err, data) => {
      if (err) {
        reject(err);
      }

      resolve(data);
    });
  });
};
