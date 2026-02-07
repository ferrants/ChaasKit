import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Admin Waitlist',
  load: () => import('@chaaskit/client/routes/AdminWaitlistRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
