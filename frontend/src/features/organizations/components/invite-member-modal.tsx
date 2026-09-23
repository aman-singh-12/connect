'use client';

import { useState } from 'react';
import { useCreateInvite } from '@/features/organizations/hooks/useOrganizations';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Role, ApiError } from '@/types';
import { useToast } from '@/components/toast';
import { IconMail, IconCheck, IconCopy } from '@/components/icons';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getInviteErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'ALREADY_MEMBER':
        return 'This user is already a member of the organization.';
      case 'INSUFFICIENT_ROLE':
        return 'You need admin access to invite members.';
      case 'PLAN_LIMIT_EXCEEDED':
        return 'Your plan has reached the member limit.';
      case 'INVITE_ALREADY_USED':
        return error.message;
      case 'VALIDATION_ERROR':
        return error.message;
    }
  }
  return error.message || 'Failed to send invitation. Please try again.';
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.MEMBER);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createInvite = useCreateInvite();
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    try {
      const res = await createInvite.mutateAsync({
        email: trimmed,
        role,
      });

      const data = res.data.data;
      setSentTo(trimmed);
      setInviteUrl(data?.inviteUrl ?? null);

      toast.success({
        title: 'Invitation dispatched',
        description: `Invite link prepared and emailed to ${trimmed}.`,
      });
    } catch {
      // Error handled by query state
    }
  }

  function handleCopyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success({
      title: 'Link copied',
      description: 'Invite link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setEmail('');
    setRole(Role.MEMBER);
    setSentTo(null);
    setInviteUrl(null);
    setCopied(false);
    createInvite.reset();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite member">
      {createInvite.error && !sentTo && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {getInviteErrorMessage(createInvite.error)}
        </div>
      )}

      {sentTo ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-success-200 bg-success-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-700">
                <IconMail className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-success-900">
                  Invitation sent!
                </p>
                <p className="mt-0.5 text-xs text-success-700 leading-relaxed">
                  We sent an invitation email to <strong className="text-success-900">{sentTo}</strong>.
                  They can accept from their inbox to join this workspace.
                </p>
              </div>
            </div>
          </div>

          {inviteUrl && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700">
                  Direct invitation link (valid 24 hours):
                </span>
                <span className="text-[11px] text-neutral-400">Share directly if needed</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800 select-all focus:outline-hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  leftIcon={copied ? <IconCheck className="h-3.5 w-3.5 text-success-600" /> : <IconCopy className="h-3.5 w-3.5" />}
                  className="shrink-0"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              id="invite-email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
            <p className="mt-1 text-xs text-neutral-500">
              We&apos;ll email them a secure link to join this workspace.
            </p>
          </div>

          <Select
            id="invite-role"
            label="Role"
            value={role}
            onChange={(v) => setRole(v as Role)}
            options={[
              { value: Role.MEMBER, label: 'Member' },
              { value: Role.ADMIN, label: 'Admin' },
            ]}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createInvite.isPending} disabled={!email.trim()}>
              Send invitation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
