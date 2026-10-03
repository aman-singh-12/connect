'use client';

import { useEffect } from 'react';
import { useAuthStore, type AuthState } from '@/store/auth.store';
import { useOrganizations } from '@/features/organizations/hooks/useOrganizations';
import { computeOrgWorkspaceGate } from '@/features/organizations/lib/org-workspace-gate';

/**
 * Workspace/org context for the signed-in user (from org list + persisted current org id).
 * Use `hasValidOrgContext` to gate org-scoped React Query requests.
 */
export function useOrgWorkspaceContext() {
  const currentOrganizationId = useAuthStore((s: AuthState) => s.currentOrganizationId);
  const setCurrentOrganization = useAuthStore((s: AuthState) => s.setCurrentOrganization);
  const { data: orgs, isLoading, isError, isSuccess } = useOrganizations();

  const hasAnyOrganization = isSuccess && !!orgs && orgs.length > 0;
  const hasValidOrgContext = computeOrgWorkspaceGate(orgs, isSuccess, currentOrganizationId);

  useEffect(() => {
    if (isSuccess && orgs && orgs.length > 0) {
      if (!currentOrganizationId || !orgs.some((o) => o.id === currentOrganizationId)) {
        setCurrentOrganization(orgs[0].id);
      }
    }
  }, [isSuccess, orgs, currentOrganizationId, setCurrentOrganization]);

  return {
    orgsLoading: isLoading,
    orgsError: isError,
    orgs,
    orgsLoaded: isSuccess,
    hasAnyOrganization,
    hasValidOrgContext,
    currentOrganizationId,
  };
}
