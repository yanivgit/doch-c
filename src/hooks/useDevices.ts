import { useState, useEffect, useCallback, useMemo } from 'react';
import { Device, DeviceFaultStatus } from '../types';
import { subscribeToAllDevices, subscribeToDevicesByPlatoonAndDohId } from '../firebase/services';

interface UseDevicesOptions {
  dohId: string | null;
  platoon?: string | null;
}

export function useDevices({ dohId, platoon }: UseDevicesOptions) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dohId) {
      setDevices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const onUpdate = (updatedDevices: Device[]) => {
      setDevices(updatedDevices);
      setIsLoading(false);
    };

    const onError = (err: Error) => {
      setError(err);
      setIsLoading(false);
    };

    if (platoon && platoon !== 'הכל') {
      const unsubscribe = subscribeToDevicesByPlatoonAndDohId(platoon, dohId, onUpdate, onError);
      return () => unsubscribe();
    } else {
      const unsubscribe = subscribeToAllDevices(dohId, onUpdate, onError);
      return () => unsubscribe();
    }
  }, [dohId, platoon]);

  const stats = useMemo(() => {
    const total = devices.length;
    const faulty = devices.filter(d => Boolean(d.faultStatus)).length;
    const inspection = devices.filter(d => d.faultStatus === 'inspection').length;
    const replacement = devices.filter(d => d.faultStatus === 'replacement').length;
    const verified = devices.filter(d => Boolean(d.verifiedBy)).length;

    return {
      total,
      faulty,
      inspection,
      replacement,
      verified,
      readyRate: total > 0 ? Math.round(((total - faulty) / total) * 100) : 100
    };
  }, [devices]);

  return {
    devices,
    isLoading,
    error,
    stats
  };
}
