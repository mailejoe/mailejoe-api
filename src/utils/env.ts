export const isTest = (): boolean => {
  return process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase().includes('test');
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase().includes('dev');
};

export const isStaging = (): boolean => {
  return process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase().includes('stag');
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase().includes('prod');
};
