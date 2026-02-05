import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Team Settings',
  load: () => import('@chaaskit/client/routes/TeamSettingsRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
