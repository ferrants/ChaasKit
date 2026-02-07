let mockConfig: { app?: { basePath?: string | null } } | null = null;

async function importUseBasePath() {
  vi.resetModules();
  vi.doMock('../../contexts/ConfigContext.js', () => ({
    useConfig: () => mockConfig,
  }));
  return import('../useBasePath.js');
}

async function importUseAppPath() {
  vi.resetModules();
  vi.doMock('react', () => ({
    useCallback: (fn: unknown) => fn,
  }));
  vi.doMock('../../contexts/ConfigContext.js', () => ({
    useConfig: () => mockConfig,
  }));
  return import('../useAppPath.js');
}

test('useBasePath defaults to /chat when empty', async () => {
  mockConfig = { app: { basePath: '' } };
  const { useBasePath } = await importUseBasePath();

  expect(useBasePath()).toBe('/chat');
});

test('useBasePath returns configured basePath', async () => {
  mockConfig = { app: { basePath: '/custom' } };
  const { useBasePath } = await importUseBasePath();

  expect(useBasePath()).toBe('/custom');
});

test('useAppPath builds paths with /chat default', async () => {
  mockConfig = { app: { basePath: '' } };
  const { useAppPath } = await importUseAppPath();

  const appPath = useAppPath();
  expect(appPath('/settings')).toBe('/chat/settings');
});
