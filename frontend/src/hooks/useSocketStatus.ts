'use client';

import { useSocketStore } from '@/lib/socket/client';

export function useSocketStatus() {
  const connected = useSocketStore((s) => s.connected);
  return { connected };
}
