// Basic tests for auth.service.js — uses stubs when Prisma is not available.
// These tests are lightweight and ensure the exported functions exist.

const authService = require('../auth.service');

test('auth service exposes functions', () => {
  expect(typeof authService.login).toBe('function');
  expect(typeof authService.refresh).toBe('function');
  expect(typeof authService.logout).toBe('function');
  expect(typeof authService.changePassword).toBe('function');
  expect(typeof authService.forgotPassword).toBe('function');
  expect(typeof authService.resetPassword).toBe('function');
});
