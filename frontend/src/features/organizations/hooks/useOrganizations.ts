'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  organizationsApi,
  type CreateOrganizationPayload,
  type CreateInvitePayload,
} from '@/lib/api/organizations.api';
import { useAuthStore } from '@/store/auth.store';
import { computeOrgWorkspaceGate } from '@/features/organizations/lib/org-workspace-gate';
import { leaveOrgRoom, joinOrgRoom } from '@/lib/socket';
import type { OrganizationWithRole, Membership, Role, PendingInvite } from '@/types';

export const orgKeys = {
  all: ['organizations'] as const,
  currentRoot: ['organizations', 'current'] as const,
  current: (orgId: string | null) => ['organizations', 'current', orgId] as const,
  membersRoot: ['organizations', 'members'] as const,
  members: (orgId: string | null) => ['organizations', 'members', orgId] as const,
  invitesRoot: ['organizations', 'invites'] as const,
  invites: (orgId: string | null) => ['organizations', 'invites', orgId] as const,
};

export function useOrganizations() {
  return useQuery({
    queryKey: orgKeys.all,
    queryFn: () => organizationsApi.list().then((r) => r.data.data! as OrganizationWithRole[]),
  });
}

export function useCurrentOrganization() {
  const currentOrganizationId = useAuthStore((s) => s.currentOrganizationId);
  const { data: orgs, isSuccess } = useOrganizations();
  const gate = computeOrgWorkspaceGate(orgs, isSuccess, currentOrganizationId);

  return useQuery({
    queryKey: orgKeys.current(currentOrganizationId),
    queryFn: () => {
      const found = orgs?.find((o) => o.id === currentOrganizationId);
      if (found) return found;
      return organizationsApi.getCurrent().then((r) => r.data.data!);
    },
    enabled: gate,
    initialData: () => orgs?.find((o) => o.id === currentOrganizationId),
  });
}

export function useOrgMembers() {
  const currentOrganizationId = useAuthStore((s) => s.currentOrganizationId);
  const { data: orgs, isSuccess } = useOrganizations();
  const gate = computeOrgWorkspaceGate(orgs, isSuccess, currentOrganizationId);

  return useQuery({
    queryKey: orgKeys.members(currentOrganizationId),
    queryFn: () => organizationsApi.getMembers().then((r) => r.data.data! as Membership[]),
    enabled: gate,
  });
}

export function usePendingInvites() {
  const currentOrganizationId = useAuthStore((s) => s.currentOrganizationId);
  const { data: orgs, isSuccess } = useOrganizations();
  const gate = computeOrgWorkspaceGate(orgs, isSuccess, currentOrganizationId);

  return useQuery({
    queryKey: orgKeys.invites(currentOrganizationId),
    queryFn: () =>
      organizationsApi.listPendingInvites().then((r) => r.data.data! as PendingInvite[]),
    enabled: gate,
  });
}

export function useCurrentOrgRole(): Role | null {
  const currentOrganizationId = useAuthStore((s) => s.currentOrganizationId);
  const { data: orgs } = useOrganizations();

  if (!orgs || !currentOrganizationId) return null;
  const current = orgs.find((o) => o.id === currentOrganizationId);
  return current?.role ?? null;
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) =>
      organizationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
  });
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const { currentOrganizationId, setCurrentOrganization } = useAuthStore();

  return useMutation({
    mutationFn: (orgId: string) => organizationsApi.switchOrg(orgId),
    onSuccess: (_, orgId) => {
      if (currentOrganizationId) {
        leaveOrgRoom(currentOrganizationId);
      }
      setCurrentOrganization(orgId);
      joinOrgRoom(orgId);

      queryClient.invalidateQueries({ queryKey: orgKeys.currentRoot });
      queryClient.invalidateQueries({ queryKey: orgKeys.membersRoot });
      queryClient.invalidateQueries({ queryKey: orgKeys.invitesRoot });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInvitePayload) =>
      organizationsApi.createInvite(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.invitesRoot });
      queryClient.invalidateQueries({ queryKey: orgKeys.membersRoot });
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => organizationsApi.resendInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.invitesRoot });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => organizationsApi.acceptInvite(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
      queryClient.invalidateQueries({ queryKey: orgKeys.currentRoot });
      queryClient.invalidateQueries({ queryKey: orgKeys.membersRoot });
      queryClient.invalidateQueries({ queryKey: orgKeys.invitesRoot });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

