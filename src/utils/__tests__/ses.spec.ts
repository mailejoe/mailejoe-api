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
        email: chance.email(),
        html: chance.string(),
        subject: chance.string(),
        txt: chance.string(),
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
                Data: emailProps.html
              },
            },
            Subject: {
              Charset: 'UTF-8',
              Data: emailProps.subject,
            }
          },
        },
        FromEmailAddress: 'no-reply@mailejoe.com',
      };
      sesMock.on(SendEmailCommand, expectedParams)
        .resolves({});
      expect(async () => {
        await sendEmail(emailProps)
      }).not.toThrow();
    });

    it('should throw an error if the email fails to send', async () => {
      const emailProps = {
        email: chance.email(),
        html: chance.string(),
        subject: chance.string(),
        txt: chance.string(),
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