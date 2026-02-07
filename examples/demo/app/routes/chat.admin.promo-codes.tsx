import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'Admin Promo Codes',
  load: () => import('@chaaskit/client/routes/AdminPromoCodesRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
