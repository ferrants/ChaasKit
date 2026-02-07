import { setConfig, resetConfig } from '../../config/loader.js';
import { buildTestConfig } from '../../__tests__/test-utils.js';
import { getPlanUsageTool } from '../get-plan-usage.js';

afterEach(() => {
  resetConfig();
});

test('get-plan-usage returns structuredContent when payments disabled', async () => {
  const config = buildTestConfig({
    payments: {
      enabled: false,
      provider: 'stripe',
      plans: [
        {
          id: 'free',
          name: 'Free',
          type: 'free',
          params: { monthlyMessageLimit: 20 },
        },
      ],
    },
  });

  setConfig(config);

  const result = await getPlanUsageTool.execute({}, {});

  expect(result.structuredContent).toBeDefined();
  expect(result.structuredContent?.planName).toBe('Free');
});
