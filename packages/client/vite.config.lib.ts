import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Library build configuration for @chaaskit/client
// This builds the package as an importable library for consumer projects
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist/lib',
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.tsx'),
        extensions: path.resolve(__dirname, 'src/extensions/index.ts'),
        ssr: path.resolve(__dirname, 'src/ssr.ts'),
        'ssr-utils': path.resolve(__dirname, 'src/ssr-utils.tsx'),
        routes: path.resolve(__dirname, 'src/routes/index.ts'),
        // Individual route modules for lazy loading
        'routes/ChatRoute': path.resolve(__dirname, 'src/routes/ChatRoute.tsx'),
        'routes/ApiKeysRoute': path.resolve(__dirname, 'src/routes/ApiKeysRoute.tsx'),
        'routes/DocumentsRoute': path.resolve(__dirname, 'src/routes/DocumentsRoute.tsx'),
        'routes/AutomationsRoute': path.resolve(__dirname, 'src/routes/AutomationsRoute.tsx'),
        'routes/TeamSettingsRoute': path.resolve(__dirname, 'src/routes/TeamSettingsRoute.tsx'),
        'routes/AdminDashboardRoute': path.resolve(__dirname, 'src/routes/AdminDashboardRoute.tsx'),
        'routes/AdminUsersRoute': path.resolve(__dirname, 'src/routes/AdminUsersRoute.tsx'),
        'routes/AdminTeamsRoute': path.resolve(__dirname, 'src/routes/AdminTeamsRoute.tsx'),
        'routes/AdminTeamRoute': path.resolve(__dirname, 'src/routes/AdminTeamRoute.tsx'),
        'routes/AdminWaitlistRoute': path.resolve(__dirname, 'src/routes/AdminWaitlistRoute.tsx'),
        'routes/AdminPromoCodesRoute': path.resolve(__dirname, 'src/routes/AdminPromoCodesRoute.tsx'),
        'routes/VerifyEmailRoute': path.resolve(__dirname, 'src/routes/VerifyEmailRoute.tsx'),
        'routes/AcceptInviteRoute': path.resolve(__dirname, 'src/routes/AcceptInviteRoute.tsx'),
        'routes/PricingRoute': path.resolve(__dirname, 'src/routes/PricingRoute.tsx'),
        'routes/OAuthConsentRoute': path.resolve(__dirname, 'src/routes/OAuthConsentRoute.tsx'),
        'routes/PrivacyRoute': path.resolve(__dirname, 'src/routes/PrivacyRoute.tsx'),
        'routes/TermsRoute': path.resolve(__dirname, 'src/routes/TermsRoute.tsx'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-router',
        'react/jsx-runtime',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router': 'ReactRouter',
        },
        // Use stable filenames without hashes
        assetFileNames: (assetInfo) => {
          // Rename the CSS file to styles.css for the export
          if (assetInfo.name?.endsWith('.css')) {
            return 'styles.css';
          }
          return '[name][extname]';
        },
      },
    },
    sourcemap: true,
    minify: false,
    cssCodeSplit: false,
  },
});
