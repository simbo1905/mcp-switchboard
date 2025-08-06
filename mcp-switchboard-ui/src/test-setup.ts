import '@testing-library/jest-dom';

// Ensure DOM environment
global.window = global.window || {};
global.document = global.document || {};

// Mock browser environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:5173'
  },
  writable: true
});

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};