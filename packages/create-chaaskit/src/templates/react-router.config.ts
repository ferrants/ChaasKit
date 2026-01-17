import type { Config } from '@react-router/dev/config';

export default {
  // Server-side rendering enabled
  ssr: true,

  // Future flags for v7 compatibility
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
