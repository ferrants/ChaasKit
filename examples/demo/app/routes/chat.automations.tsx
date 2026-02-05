import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Automations',
  load: () => import('@chaaskit/client/routes/AutomationsRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
