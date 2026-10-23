import React, { createContext, useContext, type ReactNode } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';

const CosmeticContext = createContext<PlayerBootstrap['profile'] | null>(null);
export function CosmeticProvider({ profile, children }: { profile: PlayerBootstrap['profile']; children: ReactNode }) {
  return <CosmeticContext.Provider value={profile}>{children}</CosmeticContext.Provider>;
}
export function useCosmeticProfile() { return useContext(CosmeticContext); }
