'use client';

import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/lib/api/activity.api';
import { useOrgWorkspaceContext } from '@/features/organizations/hooks/useOrgWorkspaceContext';
import type { ActivityListParams } from '@/types';

export const activityKeys = {
  all: ['activity'] as const,
  list: (orgId: string | null, params?: ActivityListParams) =>
    ['activity', 'list', orgId, params] as const,
};

export function useActivity(params?: ActivityListParams) {
  const { hasValidOrgContext, currentOrganizationId } = useOrgWorkspaceContext();

  return useQuery({
    queryKey: activityKeys.list(currentOrganizationId, params),
    queryFn: () => activityApi.list(params).then((r) => r.data),
    enabled: hasValidOrgContext,
  });
}

