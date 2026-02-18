import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Create Account',
  load: () => import('@chaaskit/client/routes/RegisterRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
