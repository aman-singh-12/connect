import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentOrganizationId: string | null;
  status: AuthStatus;
  _hasHydrated: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentOrganization: (orgId: string) => void;
  setStatus: (status: AuthStatus) => void;
  setHasHydrated: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentOrganizationId: null,
      status: 'loading' as AuthStatus,
      _hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set((state) => ({
          user,
          accessToken,
          refreshToken,
          currentOrganizationId: state.currentOrganizationId ?? user.currentOrganizationId,
          status: 'authenticated',
        })),

      setUser: (user) =>
        set((state) => ({
          user,
          currentOrganizationId: state.currentOrganizationId ?? user.currentOrganizationId,
          status: 'authenticated',
        })),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setCurrentOrganization: (orgId) =>
        set({ currentOrganizationId: orgId }),

      setStatus: (status) =>
        set({ status }),

      setHasHydrated: (v) =>
        set({ _hasHydrated: v }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentOrganizationId: null,
          status: 'unauthenticated',
        }),
    }),
    {
      name: 'connect-auth',
      storage: createJSONStorage(() => ({
        getItem: (name: string): string | null => {
          if (typeof window === 'undefined') return null;
          try {
            const item = localStorage.getItem(name);
            if (!item || !item.trim() || item === 'undefined' || item === 'null') return null;
            return item;
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: string): void => {
          if (typeof window === 'undefined') return;
          try {
            localStorage.setItem(name, value);
          } catch {
            // ignore
          }
        },
        removeItem: (name: string): void => {
          if (typeof window === 'undefined') return;
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      })),
      // Avoid hydrating during SSR / missing window; Providers calls persist.rehydrate() on the client.
      skipHydration: true,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        currentOrganizationId: state.currentOrganizationId,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            useAuthStore.setState({ status: 'unauthenticated', _hasHydrated: true });
            return;
          }
          if (state) {
            if (state.accessToken && state.user) {
              useAuthStore.setState({ status: 'authenticated', _hasHydrated: true });
            } else if (state.accessToken) {
              useAuthStore.setState({ status: 'loading', _hasHydrated: true });
            } else {
              useAuthStore.setState({ status: 'unauthenticated', _hasHydrated: true });
            }
          } else {
            useAuthStore.setState({ status: 'unauthenticated', _hasHydrated: true });
          }
        };
      },
    },
  ),
);
