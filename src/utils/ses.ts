import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
});

interface EmailParameters {
  email: string;
  subject: string;
  content: string;
}

export const sendEmail = async (props: EmailParameters): Promise<void> => {
  const params = {
    Destination: {
      ToAddresses: [
        props.email,
      ]
    },
    Content: {
      Simple: {
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
    },
    FromEmailAddress: 'no-reply@mailejoe.com',
    FromEmailAddressIdentityArn: 'arn:aws:ses:us-east-1:XXXXXXXXXXX:identity/no-reply@mailjoe.com'
  };

  const command = new SendEmailCommand(params);
  await sesClient.send(command);
};
