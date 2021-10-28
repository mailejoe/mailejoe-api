import { mockClient } from 'aws-sdk-client-mock';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Chance } from 'chance';

import {
  sendEmail,
} from '../ses';

const sesMock = mockClient(SESv2Client);
const chance = new Chance();

describe('ses helper', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest.resetModules();
  });

  describe('sendEmail', () => {
    it('should successfully send an email', async () => {
      const emailProps = {
        'email': chance.email(),
        'subject': chance.string(),
        'content': chance.string(),
      };
      const expectedParams = {
        Destination: {
          ToAddresses: [
            emailProps.email,
          ]
        },
        Content: {
          Simple: {
            Body: {
              Html: {
                Charset: 'UTF-8',
                Data: emailProps.content
              },
            },
            Subject: {
              Charset: 'UTF-8',
              Data: emailProps.subject,
            }
          },
        },
        FromEmailAddress: 'no-reply@mailejoe.com',
        FromEmailAddressIdentityArn: 'arn:aws:ses:us-east-1:XXXXXXXXXXX:identity/no-reply@mailjoe.com'
      };
      sesMock.on(SendEmailCommand, expectedParams)
        .resolves({});
      expect(async () => {
        await sendEmail(emailProps)
      }).not.toThrow();
    });

    it('should throw an error if the email fails to send', async () => {
      const emailProps = {
        'email': chance.email(),
        'subject': chance.string(),
        'content': chance.string(),
      };

      const expectedErr = new Error('error');
      sesMock.on(SendEmailCommand)
        .rejects(expectedErr);
      expect(async () => {
        await sendEmail(emailProps)
      }).rejects.toThrow(expectedErr);
    });
  });
});