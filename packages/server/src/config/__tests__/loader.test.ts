import { getConfig, resetConfig } from '../loader.js';

test('default config uses /chat basePath', () => {
  resetConfig();
  const config = getConfig();
  expect(config.app.basePath).toBe('/chat');
});
