test('JWT secret fallback warns in non-production', async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', '');
  vi.resetModules();

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { generateToken } = await import('../auth.js');

  const token = generateToken('user-1', 'user@example.com');
  expect(token).toBeTruthy();
  expect(warnSpy).toHaveBeenCalledWith(
    '[Auth] JWT_SECRET is not set; using insecure dev fallback'
  );

  warnSpy.mockRestore();
  vi.unstubAllEnvs();
});

test('JWT secret missing throws in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('JWT_SECRET', '');
  vi.resetModules();

  const { generateToken } = await import('../auth.js');

  expect(() => generateToken('user-1', 'user@example.com')).toThrow(
    'JWT_SECRET is required in production'
  );

  vi.unstubAllEnvs();
});
