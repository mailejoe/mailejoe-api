import axios from 'axios';
import { Chance } from 'chance';
import { Request } from 'express';
import { Socket } from 'net';

import { getIP, getIPInfo } from '../ip-info';
import { mockValue, MockType } from '../../testing';

jest.mock('axios');

const chance = new Chance();

describe('ip-info utility', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('getIP', () => {
    let expectedIP,
        requestGet = jest.fn();
    
    beforeEach(() => {
      expectedIP = chance.string();
    });

    afterEach(() => {
      requestGet.mockRestore();
    });

    it('should return empty string if header and socket don\'t exist', async () => {
      const mockRequest: Partial<Request> = {
        get: requestGet,
      };
      
      expect(getIP(mockRequest as Request)).toBe('');
      expect(requestGet).toBeCalledWith('x-forwarded-for');
    });
    
    it('should return ip from x-forwarded-for if it exists', async () => {
      const mockRequest: Partial<Request> = {
        get: requestGet,
      };
      
      mockValue(requestGet, MockType.Return, expectedIP);

      expect(getIP(mockRequest as Request)).toBe(expectedIP);
      expect(requestGet).toBeCalledWith('x-forwarded-for');
    });

    it('should return from socket address if x-forwarded-for does not exist', async () => {
      const socket: Partial<Socket> = { remoteAddress: expectedIP };
      const mockRequest: Partial<Request> = {
        get: requestGet,
        socket: socket as Socket,
      };
      
      mockValue(requestGet, MockType.Return, undefined);

      expect(getIP(mockRequest as Request)).toBe(expectedIP);
      expect(requestGet).toBeCalledWith('x-forwarded-for');
    });

    it('should return empty string if socket address is not defined', async () => {
      const socket: Partial<Socket> = { remoteAddress: undefined };
      const mockRequest: Partial<Request> = {
        get: requestGet,
        socket: socket as Socket,
      };

      mockValue(requestGet, MockType.Return, undefined);
      
      expect(getIP(mockRequest as Request)).toBe('');
    });
  });

  describe('getIPInfo', () => {
    it('should return empty ip info when the lookup call fails', async () => {
      mockValue(axios.get, MockType.Reject, new Error('error'));
      expect(await getIPInfo(chance.ip())).toStrictEqual({
        ip: null,
        city: null,
        region: null,
        country: null,
        latitude: null,
        longitude: null,
        org: null,
        postal: null,
        timezone: null
      });
    });

    it('should return ip info from API on success', async () => {    
      const expectedResponse = {
        ip: chance.string(),
        city: chance.string(),
        region: chance.string(),
        country: chance.string(),
        loc: `${chance.floating({ min: -180, max: 180 })},${chance.floating({ min: -180, max: 180 })}`,
        org: chance.string(),
        postal: chance.string(),
        timezone: chance.string()
      };
      mockValue(axios.get, MockType.Resolve, { data: expectedResponse });
      expect(await getIPInfo(chance.ip())).toStrictEqual({
        ip: expectedResponse.ip,
        city: expectedResponse.city,
        region: expectedResponse.region,
        country: expectedResponse.country,
        latitude: Number(expectedResponse.loc.split(',')[0]),
        longitude: Number(expectedResponse.loc.split(',')[1]),
        org: expectedResponse.org,
        postal: expectedResponse.postal,
        timezone: expectedResponse.timezone
      });
    });
  });
});