import { Chance } from 'chance';
import { Request, Response, NextFunction } from 'express';
import { configure } from 'i18n';
import { Settings } from 'luxon';
import { join } from 'path';

import { RateLimit } from '../../entity';
import { rateLimit } from '../rate-limit';
import * as ipUtils from '../../utils/ip-info';

import { MockType, mockValue, mockRestore } from '../../testing';

const chance = new Chance();
const findOne = jest.fn();
const save = jest.fn();
const mockEntityManager = { findOne, save };

jest.mock('jsonwebtoken');
jest.mock('typeorm', () => {
  return {
    ...(jest.requireActual('typeorm')),
    getManager: jest.fn(() => mockEntityManager),
  };
});
jest.mock('../../utils/ip-info');

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/../../locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

describe('rate-limit middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();
  let json = jest.fn();
  
  afterAll(async () => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRequest = {
      cookies: {},
      headers: {},
      url: chance.string(),
      locale: 'en',
    };
    mockResponse = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnValue({ json }),
    };
  });

  afterEach(() => {
    mockRestore(findOne);
    mockRestore(save);
    mockRestore(mockResponse.setHeader);
    mockRestore(mockResponse.status);
    mockRestore(nextFunction);
  });

  it('should create new rate limit on non-authed endpoint', async () => {
    const expectedIP = chance.string();

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, false);

    Settings.now = () => new Date(2018, 4, 25).valueOf();

    await rateLimit(chance.integer(), '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(ipUtils.getIP).toHaveBeenCalledWith(mockRequest);
    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { clientIdentifier: expectedIP, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      clientIdentifier: expectedIP,
      route: mockRequest.url,
      callCount: 1,
      firstCalledOn: new Date('2018-05-25T05:00:00.000Z'),
      user: null,
    })
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should create new rate limit on authed endpoint', async () => {
    const expectedIP = chance.string();

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, false);

    Settings.now = () => new Date(2018, 4, 25).valueOf();

    mockRequest = {
      ...mockRequest,
      session: { user: { id: chance.string() } },
    };

    await rateLimit(chance.integer(), '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(ipUtils.getIP).toHaveBeenCalledWith(mockRequest);
    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { userId: mockRequest.session.user.id, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      user: mockRequest.session.user,
      clientIdentifier: expectedIP,
      route: mockRequest.url,
      callCount: 1,
      firstCalledOn: new Date('2018-05-25T05:00:00.000Z'),
    })
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should increment call count on existing rate limit on non-authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 1, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    await rateLimit(chance.integer({ min: 100 }), '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { clientIdentifier: expectedIP, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      ...expectedRateLimit,
      callCount: 2,
    })
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should increment call count on existing rate limit on authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 1, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    mockRequest = {
      ...mockRequest,
      session: { user: { id: chance.string() } },
    };

    await rateLimit(chance.integer({ min: 100 }), '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { userId: mockRequest.session.user.id, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      ...expectedRateLimit,
      callCount: 2,
    })
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should return 429 when call count reaches rate limit on non-authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 9, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    await rateLimit(10, '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { clientIdentifier: expectedIP, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      ...expectedRateLimit,
      firstCalledOn: new Date('2018-05-25T05:00:00.000Z'),
    });
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 1 * 60 * 60 * 1000);
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: 'Too many requests, please try again later.' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 429 when call count reaches rate limit on authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 9, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    mockRequest = {
      ...mockRequest,
      session: { user: { id: chance.string() } },
    };

    await rateLimit(10, '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { userId: mockRequest.session.user.id, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      ...expectedRateLimit,
      firstCalledOn: new Date('2018-05-25T05:00:00.000Z'),
    });
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 1 * 60 * 60 * 1000);
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: 'Too many requests, please try again later.' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 429 after call count reaches rate limit and within jail timebox on non-authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 10, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    Settings.now = () => new Date(2018, 4, 25, 0, 30).valueOf();

    await rateLimit(10, '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { clientIdentifier: expectedIP, route: mockRequest.url } });
    expect(save).not.toHaveBeenCalled();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 30 * 60 * 1000);
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: 'Too many requests, please try again later.' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 429 after call count reaches rate limit and within jail timebox on authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 10, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    Settings.now = () => new Date(2018, 4, 25, 0, 30).valueOf();

    mockRequest = {
      ...mockRequest,
      session: { user: { id: chance.string() } },
    };

    await rateLimit(10, '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { userId: mockRequest.session.user.id, route: mockRequest.url } });
    expect(save).not.toHaveBeenCalled();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 30 * 60 * 1000);
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: 'Too many requests, please try again later.' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reset rate-limit after bucket time lapses on non-authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 10, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    Settings.now = () => new Date(2018, 4, 25, 1, 1).valueOf();

    await rateLimit(10, '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { clientIdentifier: expectedIP, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      ...expectedRateLimit,
      callCount: 1,
      firstCalledOn: new Date('2018-05-25T06:01:00.000Z'),
    });
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should reset rate-limit after bucket time lapses on authed endpoint', async () => {
    const expectedIP = chance.string();
    const expectedRateLimit = { callCount: 10, firstCalledOn: new Date('2018-05-25T05:00:00.000Z') };

    mockValue(ipUtils.getIP, MockType.Return, expectedIP);
    mockValue(findOne, MockType.Resolve, expectedRateLimit);

    Settings.now = () => new Date(2018, 4, 25, 1, 1).valueOf();

    mockRequest = {
      ...mockRequest,
      session: { user: { id: chance.string() } },
    };

    await rateLimit(10, '01:00', '01:00')(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(findOne).toHaveBeenCalledWith(RateLimit, { where: { userId: mockRequest.session.user.id, route: mockRequest.url } });
    expect(save).toHaveBeenCalledWith({
      ...expectedRateLimit,
      callCount: 1,
      firstCalledOn: new Date('2018-05-25T06:01:00.000Z'),
    });
    expect(nextFunction).toHaveBeenCalled();
  });

  describe('multiple authed calls', () => {

  });

  describe('multiple non-authed calls', () => {

  });
});