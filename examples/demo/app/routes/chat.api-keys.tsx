import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'API Keys',
  load: () => import('@chaaskit/client/routes/ApiKeysRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
