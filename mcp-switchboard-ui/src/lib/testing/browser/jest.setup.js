/**
 * Jest Setup for Browser Tests
 */

// Set default environment variables for testing
process.env.MOCK_API_PORT = process.env.MOCK_API_PORT || '3001';
process.env.CI = process.env.CI || 'false';

// Global test timeout
jest.setTimeout(30000);

// Console configuration for tests
if (process.env.VERBOSE_TESTS) {
  console.log('[JEST SETUP] Verbose browser testing enabled');
}