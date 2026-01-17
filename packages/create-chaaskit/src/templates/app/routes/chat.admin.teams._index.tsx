import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Admin - Teams',
  load: () => import('@chaaskit/client/routes/AdminTeamsRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
