import { Chance } from 'chance';
import axios from 'axios';

import { getIPInfo } from '../ip-info';

jest.mock('axios');

const chance = new Chance();

describe('ip-info utility', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });
  
  it('should return empty ip info when the lookup call fails', async () => {
    (axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValue(new Error('error'));
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
    (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
      data: expectedResponse,
    });
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