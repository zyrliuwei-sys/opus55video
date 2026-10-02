import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getTrialUpgradeStatus } from '@/modules/payment/service';
import { respData } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return respData({ trialPurchased: false, upgradeAvailable: false });
  }
  return respData(await getTrialUpgradeStatus(session.user.id));
}

export const Route = createFileRoute('/api/payment/upgrade-offer')({
  server: { handlers: { GET } },
});
