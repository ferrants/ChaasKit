import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Admin Team',
  load: () => import('@chaaskit/client/routes/AdminTeamRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
