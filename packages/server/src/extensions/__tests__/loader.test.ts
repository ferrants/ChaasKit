import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { loadExtensions } from '../loader.js';

const mockFiles = vi.hoisted(() => ({ files: [] as string[] }));

vi.mock('../glob.js', () => ({
  glob: async () => mockFiles.files,
}));

test('loads extensions from extensions/jobs', async () => {
  const baseDir = path.resolve('tests/tmp/extensions-test');
  const jobsDir = path.join(baseDir, 'extensions', 'jobs');
  await mkdir(jobsDir, { recursive: true });

  const jobFile = path.join(jobsDir, 'test-job.js');
  await writeFile(jobFile, 'export const name = \"test\";');

  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  mockFiles.files = [jobFile];

  await loadExtensions(baseDir);

  const logCalls = logSpy.mock.calls.map((call) => call.join(' '));
  expect(logCalls.some((line) => line.includes('extensions/jobs/test-job.js'))).toBe(true);

  logSpy.mockRestore();
});
