import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Accept Invitation',
  load: () => import('@chaaskit/client/routes/AcceptInviteRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
