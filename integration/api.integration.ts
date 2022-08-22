import axios from 'axios';
import * as Chance from 'chance';
import { totp } from 'speakeasy';
import { GenericContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';

import { Organization, User } from '../src/entity';
import { runServer, stopServer } from '../src/main';

const chance = new Chance();

describe('integration', () => {
  let container,
      dataSource;
  
  beforeAll(async () => {
    axios.defaults.baseURL = 'http://localhost:3000/api/v1';

    container = await new GenericContainer('postgres')
      .withExposedPorts({
        container: 5432,
        host: 5000
      })
      .withEnv('TZ', 'America/Chicago')
      .withEnv('PGTZ', 'America/Chicago')
      .withEnv('POSTGRES_USER', 'mjadmin')
      .withEnv('POSTGRES_PASSWORD', 'password')
      .withEnv('POSTGRES_DB', 'mailejoe')
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start();

    await new Promise(r => setTimeout(r, 5000));

    dataSource = new DataSource({
      type: 'postgres',
      username: 'mjadmin',
      password: 'password',
      database: 'mailejoe',
      port: 5000,
      host: '127.0.0.1',
      migrationsTableName: 'mailejoe_migrations',
      entities: [
        'src/entity/*.ts'
      ],
      migrations: [
        'migrations/*.ts'
      ],
      synchronize: false,
      logging: 'all'
    });

    await dataSource.initialize();
    
    await dataSource.runMigrations({
      transaction: 'each',
    });

    await runServer();

    await new Promise(r => setTimeout(r, 5000));
  });

  afterAll(async () => {
    await dataSource.destroy();

    await new Promise(r => setTimeout(r, 5000));
    
    await stopServer();
    await container.stop();
  });

  describe('ping', () => {

    it ('should return 200 and pong response', async () => {
      const response = await axios({
        url: 'http://localhost:3000/ping',
        method: 'get',
      });
      expect(response.status).toBe(200);
      expect(response.data).toBe('pong');
    });

  });

  describe('auth', () => {
    let email,
        loginToken,
        mfaSecret;

    describe('/setup', () => {
      let orgName;

      it ('should return 200 and generate a new organization', async () => {
        orgName = chance.string();
        email = chance.email();
        const response = await axios({
          url: '/setup',
          method: 'post',
          data: {
            name: orgName,
            firstName: chance.string(),
            lastName: chance.string(),
            email,
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(204);

        const repository = dataSource.getRepository(User);
        const user = await repository.createQueryBuilder('user')
          .select([
            'user.id', 'user.first_name', 'user.reset_token',
          ])
          .getMany();
        console.log('$$$$$$$$$$$$$', user);
      });

      it ('should return 400 when org name is not unique', async () => {
        try {
          await axios({
            url: '/setup',
            method: 'post',
            data: {
              name: orgName,
              firstName: chance.string(),
              lastName: chance.string(),
              email: chance.email(),
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch(err) {
          expect(err.response.status).toBe(400);
          expect(err.response.data).toStrictEqual({ error: 'Organization name must be unique' });
        }
      });

      it ('should return 400 when email address is not unique', async () => {
        try {
          await axios({
            url: '/setup',
            method: 'post',
            data: {
              name: chance.string(),
              firstName: chance.string(),
              lastName: chance.string(),
              email: email,
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch(err) {
          expect(err.response.status).toBe(400);
          expect(err.response.data).toStrictEqual({ error: 'Email must be unique' });
        }
      });

    });

    describe('/reset-password & /forgot-password', () => {
      it ('should return 403 if token does not match', async () => {
        try {
          await axios({
            url: `/password-reset?token=${chance.string()}`,
            method: 'post',
            data: {
              password: chance.string(),
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch (err) {
          expect(err.response.status).toBe(403);
          expect(err.response.data).toStrictEqual({ error: 'Unauthorized' });
        }
      });

      it ('should return 200 and reset the password', async () => {
        const repository = dataSource.getRepository(User);
        const user = await repository.createQueryBuilder('user')
          .where({ email })
          .select([
            'user.id', 'user.reset_token',
          ])
          .getRawOne();

        const response = await axios({
          url: `/password-reset?token=${user.reset_token}`,
          method: 'post',
          data: {
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(200);
        expect(response.data).toStrictEqual({ message: 'Your password has been successfully updated.' });
      });

      it ('should return 400 when trying to re-use an old password', async () => {
        await axios({
          url: '/forgot-password',
          method: 'post',
          data: {
            email,
          },
          headers: {'Content-Type': 'application/json'}
        });

        const user = await dataSource.manager.findOne(User, {
          where: { email },
          select: {
            id: true,
            resetToken: true,
            organization: {
              id: true,
            },
          },
          relations: {
            organization: true,
          }
        });

        await dataSource.manager.update(Organization, user.organization.id, { pwdReused: 10 });

        try {
          await axios({
            url: `/password-reset?token=${user.resetToken}`,
            method: 'post',
            data: {
              password: 'th3yIOp9!!pswYY#',
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch (err) {
          expect(err.response.status).toBe(400);
          expect(err.response.data).toStrictEqual({ error: 'Password must not match a password you have used previously.' });
        }
      });

    });

    describe('/login', () => {

      it ('should return 200 and successfully login without mfa', async () => {
        await dataSource.manager.update(User, { email }, { mfaEnabled: false });

        const response = await axios({
          url: '/login',
          method: 'post',
          data: {
            email,
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(200);
        expect((response.data as any).mfaEnabled).toBe(false);
      });

      it ('should return 200 and successfully login with mfa', async () => {
        await dataSource.manager.update(User, { email }, { mfaEnabled: true });

        const response = await axios({
          url: '/login',
          method: 'post',
          data: {
            email,
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(200);
        expect((response.data as any).mfaEnabled).toBe(true);

        loginToken = (response.data as any).token;
      });

      it ('should return 403 if already logged in and multiple sessions not allowed', async () => {
        const user = await dataSource.manager.findOne(User,
          { where: { email },
          relations: ['organization'],
        });
        
        await dataSource.manager.update(Organization, user.organization.id, { allowMultipleSessions: false });

        try {
          await axios({
            url: '/login',
            method: 'post',
            data: {
              email,
              password: 'th3yIOp9!!pswYY#',
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch (err) {
          expect(err.response.status).toBe(403);
          expect(err.response.data).toStrictEqual({ error: 'Please logout all existing sessions and try again.' });
        }
      });

    });

    describe('/setup-mfa & /confirm-mfa', () => {

      it ('should return 200 and setup MFA for the user', async () => {
        await dataSource.manager.update(User, { email }, { mfaEnabled: true, mfaSecret: null });

        let response = await axios({
          url: '/login',
          method: 'post',
          data: {
            email,
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'},
          withCredentials: true,
        });
        expect(response.status).toBe(200);
        expect((response.data as any).mfaEnabled).toBe(true);

        const cookie = response.headers['set-cookie'][0];
        const authToken = (response.data as any).token;
        const initToken = (response.data as any).mfaSetupToken;

        response = await axios({
          withCredentials: true,
          url: '/setup-mfa',
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-AUTHORIZE-MAILEJOE': initToken,
            'cookie': cookie,
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('code');
        expect(response.data).toHaveProperty('qrcode');

        mfaSecret = (response.data as any).code

        const token = totp({
          secret: mfaSecret,
          encoding: 'base32'
        });

        response = await axios({
          withCredentials: true,
          url: '/confirm-mfa',
          method: 'post',
          data: {
            token,
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-AUTHORIZE-MAILEJOE': initToken,
            'cookie': cookie,
          }
        });

        expect(response.status).toBe(204);
      });
    });

    describe('/mfa', () => {

      it('should fail to login when mfa token is invalid', async () => {
        let response = await axios({
          url: '/login',
          method: 'post',
          data: {
            email,
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(200);
        expect((response.data as any).mfaEnabled).toBe(true);

        const cookie = response.headers['set-cookie'][0];
        const authToken = (response.data as any).token;

        try {
          response = await axios({
            withCredentials: true,
            url: '/mfa',
            method: 'post',
            data: {
              token: chance.word(),
            },
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'cookie': cookie,
            }
          });
        } catch (err) {
          expect(err.response.status).toBe(403);
          expect(err.response.data).toStrictEqual({ error: 'Token provided is not valid.' });
        }
      });
      
      it('should successfully login with mfa', async () => {
        let response = await axios({
          url: '/login',
          method: 'post',
          data: {
            email,
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(200);
        expect((response.data as any).mfaEnabled).toBe(true);

        const cookie = response.headers['set-cookie'][0];
        const authToken = (response.data as any).token;
        const token = totp({
          secret: mfaSecret,
          encoding: 'base32'
        });

        response = await axios({
          withCredentials: true,
          url: '/mfa',
          method: 'post',
          data: {
            token,
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'cookie': cookie,
          }
        });

        expect(response.status).toBe(204);
      });
    
    });
  });
});