import '@testing-library/jest-dom';
import { setupMockTauri } from './lib/testing/mockTauri';
import { vi } from 'vitest';

// Ensure DOM environment
global.window = global.window || {};
global.document = global.document || {};

// Set up mock Tauri environment for all tests
setupMockTauri();

// Mock console methods to avoid noise in tests (but keep error for important issues)
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};