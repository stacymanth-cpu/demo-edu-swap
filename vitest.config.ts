import { configDefaults, defineConfig } from 'vitest/config';

// Unit tests. The rules tests in tests/rules need the emulator and run
// separately through vitest.rules.config.ts.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/rules/**', 'functions/lib/**', 'functions/node_modules/**'],
  },
});
