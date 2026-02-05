import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Admin Dashboard',
  load: () => import('@chaaskit/client/routes/AdminDashboardRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
