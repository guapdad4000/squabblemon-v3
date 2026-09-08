import { createContext, useContext, useMemo, useRef, useState } from 'react';
import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useClerk as useClerkClient,
  type ClerkProviderProps,
} from '@clerk/react';
import { useLocation } from 'wouter';

const e2eAuthEnabled = import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === 'true';
const storageKey = 'squabblemon_e2e_user';
const afterSignInKey = 'squabblemon_after_sign_in';

function getAfterSignIn(): string {
  const intended = sessionStorage.getItem(afterSignInKey);
  return intended?.startsWith('/game') ? intended : '/game';
}

function consumeAfterSignIn(): string {
  const intended = getAfterSignIn();
  clearAfterSignIn();
  return intended;
}

function clearAfterSignIn() {
  sessionStorage.removeItem(afterSignInKey);
}

type AuthSnapshot = { isLoaded: boolean; isSignedIn: boolean };
type Listener = (snapshot: { user: { id: string } | null }) => void;
type TestAuthContextValue = AuthSnapshot & {
  addListener: (listener: Listener) => () => void;
  signIn: () => void;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
};

const TestAuthContext = createContext<TestAuthContextValue | null>(null);

function TestAuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setSignedIn] = useState(() => localStorage.getItem(storageKey) === 'signed-in');
  const listeners = useRef(new Set<Listener>());

  const value = useMemo<TestAuthContextValue>(() => ({
    isLoaded: true,
    isSignedIn,
    addListener(listener) {
      listeners.current.add(listener);
      listener({ user: isSignedIn ? { id: 'e2e-rookie' } : null });
      return () => listeners.current.delete(listener);
    },
    signIn() {
      localStorage.setItem(storageKey, 'signed-in');
      setSignedIn(true);
      listeners.current.forEach((listener) => listener({ user: { id: 'e2e-rookie' } }));
    },
    async signOut(options) {
      localStorage.removeItem(storageKey);
      setSignedIn(false);
      listeners.current.forEach((listener) => listener({ user: null }));
      window.location.assign(options?.redirectUrl || '/');
    },
  }), [isSignedIn]);

  return <TestAuthContext.Provider value={value}>{children}</TestAuthContext.Provider>;
}

export function AppAuthProvider(props: ClerkProviderProps) {
  if (e2eAuthEnabled) return <TestAuthProvider>{props.children}</TestAuthProvider>;
  return <ClerkProvider {...props} />;
}

function useTestAuth() {
  return useContext(TestAuthContext)!;
}

export const useAppAuth = e2eAuthEnabled ? useTestAuth : useClerkAuth;
export const useAppClerk = e2eAuthEnabled ? useTestAuth : useClerkClient;

export function TestAccountEntry({ kind }: { kind: 'sign-in' | 'sign-up' }) {
  const auth = useContext(TestAuthContext);
  const [, setLocation] = useLocation();
  if (!e2eAuthEnabled || !auth) return null;
  return (
    <div className="min-h-[100dvh] bg-black text-white grid place-items-center p-6">
      <button
        type="button"
        className="bg-primary px-6 py-4 font-display font-black uppercase text-black"
        onClick={() => {
          auth.signIn();
          setLocation(consumeAfterSignIn());
        }}
      >
        {kind === 'sign-up' ? 'Create disposable test account' : 'Sign in test account'}
      </button>
    </div>
  );
}

export { e2eAuthEnabled };
export { clearAfterSignIn, consumeAfterSignIn, getAfterSignIn };