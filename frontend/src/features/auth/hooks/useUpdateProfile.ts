'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type UpdateProfilePayload } from '@/lib/api/auth.api';
import { useAuthStore } from '@/store/auth.store';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const res = await authApi.updateProfile(payload);
      return res.data;
    },
    onSuccess: (body) => {
      const user = body?.data?.user;
      if (user) {
        setUser(user);
      }
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}
