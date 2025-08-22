import { vi } from 'vitest'

// Global test setup
global.console = {
  ...console,
  // Suppress console.warn in tests unless needed
  warn: vi.fn(),
  error: vi.fn(),
}