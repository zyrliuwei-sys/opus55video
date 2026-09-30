import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/video')({
  loader: () => {
    throw redirect({ to: '/create' });
  },
});
