import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Chat',
  load: () => import('@chaaskit/client/routes/ChatRoute'),
  skeleton: 'chat',
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
