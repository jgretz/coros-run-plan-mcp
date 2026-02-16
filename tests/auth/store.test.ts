import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { readAuthConfig } from '../../src/auth/store.ts';

describe('readAuthConfig', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.COROS_EMAIL;
    delete process.env.COROS_PASSWORD;
    delete process.env.COROS_REGION;
  });

  afterEach(() => {
    process.env.COROS_EMAIL = origEnv.COROS_EMAIL;
    process.env.COROS_PASSWORD = origEnv.COROS_PASSWORD;
    process.env.COROS_REGION = origEnv.COROS_REGION;
  });

  it('should return error when email is missing', () => {
    process.env.COROS_PASSWORD = 'pass';
    const result = readAuthConfig();
    expect(result.ok).toBe(false);
  });

  it('should return error when password is missing', () => {
    process.env.COROS_EMAIL = 'test@test.com';
    const result = readAuthConfig();
    expect(result.ok).toBe(false);
  });

  it('should return config when both are set', () => {
    process.env.COROS_EMAIL = 'test@test.com';
    process.env.COROS_PASSWORD = 'pass';
    const result = readAuthConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('test@test.com');
      expect(result.value.password).toBe('pass');
      expect(result.value.region).toBe('us');
    }
  });

  it('should use specified region', () => {
    process.env.COROS_EMAIL = 'test@test.com';
    process.env.COROS_PASSWORD = 'pass';
    process.env.COROS_REGION = 'eu';
    const result = readAuthConfig();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.region).toBe('eu');
  });

  it('should reject invalid region', () => {
    process.env.COROS_EMAIL = 'test@test.com';
    process.env.COROS_PASSWORD = 'pass';
    process.env.COROS_REGION = 'invalid';
    const result = readAuthConfig();
    expect(result.ok).toBe(false);
  });
});
