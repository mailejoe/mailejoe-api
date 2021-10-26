/**
 * Returns whether the current environment is set to a test environment.
 * @return {boolean}
 */
export const isTest = (): boolean => {
  return process.env.NODE_ENV?.toLowerCase().includes('test');
};

/**
 * Returns whether the current environment is set to a development environment.
 * @return {boolean}
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV?.toLowerCase().includes('dev');
};

/**
 * Returns whether the current environment is set to a production environment.
 * @return {boolean}
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV?.toLowerCase().includes('prod');
};
