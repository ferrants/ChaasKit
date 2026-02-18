import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Admin Users',
  load: () => import('@chaaskit/client/routes/AdminUsersRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
