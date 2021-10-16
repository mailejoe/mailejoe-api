import { SES } from 'aws-sdk';

const ses = new SES({
  apiVersion: '2017-10-17',
  region: process.env.AWS_REGION,
});

interface EmailParameters {
  email: string;
  subject: string;
  content: string;
}

export const sendTxtOnlyEmail = async (props: EmailParameters): Promise<void> => {
  const params = {
    Destination: {
      ToAddresses: [
        props.email,
      ]
    },
    Message: {
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: props.content
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: props.subject,
      }
    },
    Source: 'no-reply@globalhawk.xyz',
    SourceArn: 'arn:aws:ses:us-east-1:086303270010:identity/no-reply@globalhawk.xyz'
  };

  await ses.sendEmail(params).promise();
};

export const sendEmail = async (props: EmailParameters): Promise<void> => {
  const params = {
    Destination: {
      ToAddresses: [
        props.email,
      ]
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: props.content
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: props.subject,
      }
    },
    Source: 'no-reply@globalhawk.xyz',
    SourceArn: 'arn:aws:ses:us-east-1:086303270010:identity/no-reply@globalhawk.xyz'
  };

  await ses.sendEmail(params).promise();
};
