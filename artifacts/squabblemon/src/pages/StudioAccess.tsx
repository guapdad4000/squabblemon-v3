import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useAppAuth } from '../lib/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import NotFound from './not-found';

const StoryStudio = lazy(() => import('./StoryStudio'));
const MoveStudio = lazy(() => import('./MoveStudio'));

/** Reuse the server's existing admin allowlist, without loading an editor first. */
export default function StudioAccess({ kind }: { kind: 'story' | 'moves' }) {
  const auth = useAppAuth();
  const { isLoaded, isSignedIn } = auth;
  const userId = 'userId' in auth ? auth.userId : 'development-test';
  const access = useQuery({
    queryKey: ['studio-access', userId], enabled: !!isLoaded && !!isSignedIn,
    queryFn: async ({ signal }) => {
      await customFetch('/api/admin/patches', { signal });
      return true;
    },
    retry: false, staleTime: 60_000,
  });
  if (!isLoaded || (isSignedIn && access.isPending)) return <LoadingScreen phase="account" />;
  if (!isSignedIn || access.isError || !access.data) return <NotFound />;
  return <Suspense fallback={<LoadingScreen phase="scene" />}>
    {kind === 'story' ? <StoryStudio /> : <MoveStudio />}
  </Suspense>;
}
