const DEFAULT_DEVELOPMENT_APP_URL = 'http://localhost:4000';

function isProductionRuntime(env = process.env) {
  return String(env.NODE_ENV || '').trim() === 'production' || Boolean(String(env.RENDER_SERVICE_ID || '').trim());
}

function assertProductionAppUrlConfiguration(env = process.env) {
  const value = String(env.APP_URL || '').trim();
  if (!value) {
    throw new Error('[app-url.config] APP_URL is required in production.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch (error) {
    throw new Error('[app-url.config] APP_URL must be a valid absolute URL in production.');
  }

  const hostname = String(parsedUrl.hostname || '').toLowerCase();
  const lowerValue = value.toLowerCase();
  const isLocalDevelopmentHost = (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.test') ||
    hostname.startsWith('dev.') ||
    hostname.startsWith('staging.') ||
    hostname.startsWith('preview.') ||
    hostname.startsWith('test.') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('0.0.0.0') ||
    lowerValue.includes('localhost') ||
    lowerValue.includes('127.0.0.1') ||
    lowerValue.includes('0.0.0.0')
  );

  if (isLocalDevelopmentHost) {
    throw new Error('[app-url.config] APP_URL must not use localhost or other local development hosts in production.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('[app-url.config] APP_URL must use HTTPS in production.');
  }

  const pathname = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname.replace(/\/+$/, '') : '';
  return `${parsedUrl.origin}${pathname}`;
}

function getAppUrl(env = process.env) {
  if (!isProductionRuntime(env)) {
    return String(env.APP_URL || DEFAULT_DEVELOPMENT_APP_URL).trim() || DEFAULT_DEVELOPMENT_APP_URL;
  }

  return assertProductionAppUrlConfiguration(env);
}

module.exports = {
  DEFAULT_DEVELOPMENT_APP_URL,
  isProductionRuntime,
  assertProductionAppUrlConfiguration,
  getAppUrl,
};
