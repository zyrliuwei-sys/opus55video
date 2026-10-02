import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/core/auth/client';
import { apiGet } from '@/lib/api-client';

export type UpgradeOffer = {
  trialPurchased: boolean;
  upgradeAvailable: boolean;
};

// Trial-upgrade eligibility for the signed-in user — shared by the pricing
// section and the studios' "get credits" prompts.
export function useUpgradeOffer() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  return useQuery({
    queryKey: ['upgrade-offer', userId],
    queryFn: () => apiGet<UpgradeOffer>('/api/payment/upgrade-offer'),
    enabled: Boolean(userId),
  });
}
