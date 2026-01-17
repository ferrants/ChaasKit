import { createRoute } from '@chaaskit/client/ssr-utils';

const route = createRoute({
  title: 'OAuth Consent',
  load: () => import('@chaaskit/client/routes/OAuthConsentRoute'),
});

export const meta = route.meta;
export const links = route.links;
export default route.default;
