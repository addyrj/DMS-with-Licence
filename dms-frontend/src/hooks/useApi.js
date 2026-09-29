// src/hooks/useApi.js
// Generic hook wrapping useQuery — adds loading/error/data in one call
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ui/Toast';

export function useApi(key, fn, options = {}) {
  return useQuery({ queryKey: Array.isArray(key) ? key : [key], queryFn: fn, ...options });
}

export function useMutate(fn, { successMsg, errorMsg, invalidate = [] } = {}) {
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (successMsg) toast(successMsg);
      invalidate.forEach(k => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }));
    },
    onError: (e) => toast(errorMsg || e.message, 'danger'),
  });
}
