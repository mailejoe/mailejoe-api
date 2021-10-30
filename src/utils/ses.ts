import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
});

interface EmailParameters {
  email: string;
  html: string;
  subject: string;
  txt: string;
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
            Data: props.html
          },
          Text: {
            Charset: 'UTF-8',
            Data: props.txt
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: props.subject,
        }
      },
    },
    FromEmailAddress: 'no-reply@mailejoe.com',
  };

  const command = new SendEmailCommand(params);
  await sesClient.send(command);
};
