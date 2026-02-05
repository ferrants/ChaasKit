import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Verify Email',
  load: () => import('@chaaskit/client/routes/VerifyEmailRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
