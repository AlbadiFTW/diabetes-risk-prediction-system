import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useEmailVerification() {
  const status = useQuery(api.emailVerification.isEmailVerified);
  
  return {
    isVerified: status?.verified ?? false,
    email: status?.email ?? null,
    isLoading: status === undefined,
  };
}





















