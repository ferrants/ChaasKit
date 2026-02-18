import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Sign In',
  load: () => import('@chaaskit/client/routes/LoginRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
