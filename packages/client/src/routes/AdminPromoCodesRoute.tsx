/**
 * Admin Promo Codes Route - Promo code management
 */
import { ChatProviders } from '../index';
import AdminPromoCodesPage from '../pages/AdminPromoCodesPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Admin - Promo Codes' }];
}

export function links() {
  return [];
}

export default function AdminPromoCodesRoute() {
  return (
    <ChatProviders>
      <AdminPromoCodesPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
