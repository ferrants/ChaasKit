import {
  registerJobHandler,
  clearJobHandlers,
  executeJob,
} from '../handlers/index.js';

afterEach(() => {
  clearJobHandlers();
});

test('register and execute job handler', async () => {
  registerJobHandler('email:send', async (job, ctx) => {
    ctx.log(`sending to ${job.payload.to}`);
    ctx.progress(100);
    return { ok: true };
  });

  const result = await executeJob(
    {
      id: 'job-1',
      type: 'email:send',
      payload: { to: 'user@example.com' },
      options: { maxRetries: 3, timeout: 1000, priority: 0 },
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      receiptHandle: 'rh-1',
    },
    {
      jobId: 'job-1',
      attempt: 1,
      log: () => {},
      progress: () => {},
      signal: new AbortController().signal,
    }
  );

  expect(result).toEqual({ ok: true });
});
