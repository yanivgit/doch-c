import { useState, useEffect, useCallback, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { VerificationSession } from '../types';
import { 
  getActiveSession, 
  subscribeToVerifiedDevices, 
  verifyDevice as apiVerifyDevice, 
  unverifyDevice as apiUnverifyDevice 
} from '../firebase/services';

interface UseVerificationSessionOptions {
  dohId: string | null;
  platoon?: string | null;
}

export function useVerificationSession({ dohId, platoon }: UseVerificationSessionOptions) {
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }>>({});
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    if (!dohId) {
      setSession(null);
      setIsLoading(false);
      return;
    }
    try {
      const active = await getActiveSession(dohId);
      setSession(active);
    } catch (e) {
      console.error('Error refreshing session:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dohId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!session?.id) {
      setVerifiedMap({});
      return;
    }

    const unsubscribe = subscribeToVerifiedDevices(
      session.id,
      (updatedMap) => {
        setVerifiedMap(updatedMap);
      },
      (error) => {
        console.error('Error in verified devices subscription:', error);
      },
      platoon && platoon !== 'הכל' ? platoon : undefined
    );

    return () => unsubscribe();
  }, [session?.id, platoon]);

  const verify = useCallback(async (deviceId: string, user: string, targetPlatoon?: string) => {
    if (!session?.id) return;
    await apiVerifyDevice(session.id, deviceId, user, targetPlatoon);
  }, [session?.id]);

  const unverify = useCallback(async (deviceId: string) => {
    if (!session?.id) return;
    await apiUnverifyDevice(session.id, deviceId);
  }, [session?.id]);

  const isVerified = useCallback((deviceId: string) => {
    return Boolean(verifiedMap[deviceId]);
  }, [verifiedMap]);

  return {
    session,
    verifiedMap,
    isLoading,
    refreshSession,
    verify,
    unverify,
    isVerified
  };
}
