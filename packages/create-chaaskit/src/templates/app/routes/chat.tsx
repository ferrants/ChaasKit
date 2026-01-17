import type { Route } from './+types/chat';
import { Outlet, redirect } from 'react-router';
import { config } from '../../config/app.config';

/**
 * Layout route for all /chat/* routes.
 *
 * This handles authentication - if the user is not logged in,
 * they are redirected to the login page.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get('Cookie');

  try {
    const response = await fetch(`${config.app.url}/api/auth/me`, {
      headers: {
        Cookie: cookieHeader || '',
      },
    });

    if (!response.ok) {
      // Not authenticated, redirect to login
      throw redirect('/login');
    }

    return null;
  } catch (error) {
    // If it's a redirect response, re-throw it
    if (error instanceof Response) {
      throw error;
    }
    // For other errors (network, etc.), redirect to login
    throw redirect('/login');
  }
}

export default function ChatLayout() {
  return <Outlet />;
}
