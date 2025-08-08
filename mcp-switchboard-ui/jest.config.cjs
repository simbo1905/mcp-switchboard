/**
 * Jest Configuration for Browser Tests
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/browser/*.test.js'],
  testTimeout: 30000, // 30 seconds for browser tests
  setupFilesAfterEnv: [],
  verbose: true,
  collectCoverage: false,
  maxWorkers: 1, // Run browser tests sequentially to avoid conflicts
  
  // Simple CommonJS setup
  transform: {},
  
  // Test reporting
  reporters: [
    'default'
  ],
  
  // Environment variables for testing
  setupFiles: ['<rootDir>/src/lib/testing/browser/jest.setup.js']
};