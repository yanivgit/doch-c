import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  Timestamp, 
  orderBy, 
  doc, 
  QueryConstraint 
} from 'firebase/firestore';
import { db } from '../config';
import { LogEvent, Device } from '../../types';

export const logEvent = async (event: Omit<LogEvent, 'id' | 'timestamp'>) => {
  try {
    let dohId = event.dohId;
    if (!dohId && event.deviceId) {
      try {
        const deviceRef = doc(db, 'devices', event.deviceId);
        const deviceSnap = await getDoc(deviceRef);
        if (deviceSnap.exists()) {
          dohId = (deviceSnap.data() as Device).dohId;
        }
      } catch (e) {
        console.warn("Could not fetch dohId for device in logEvent:", e);
      }
    }

    const docRef = await addDoc(collection(db, 'logs'), {
      ...event,
      ...(dohId ? { dohId } : {}),
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error logging event: ", error);
    throw error;
  }
};

export const getAllLogs = async (): Promise<LogEvent[]> => {
  try {
    const q = query(collection(db, 'logs'), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    const logs: LogEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as LogEvent);
    });
    return logs;
  } catch (error) {
    console.error("Error getting logs: ", error);
    throw error;
  }
};

export const getLogsByDateRange = async (
  startDate: Date, 
  endDate: Date,
  dohId: string,
  platoon?: string
): Promise<LogEvent[]> => {
  if (!dohId) return [];
  const cleanPlatoon = platoon?.trim();

  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  try {
    const constraints: QueryConstraint[] = [
      where("dohId", "==", dohId),
    ];

    if (cleanPlatoon) {
      constraints.push(where("involvedPlatoons", "array-contains", cleanPlatoon));
    }

    constraints.push(
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp)
    );

    const q = query(collection(db, 'logs'), ...constraints);
    const querySnapshot = await getDocs(q);
    const logs: LogEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as LogEvent);
    });
    return logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
  } catch (error: any) {
    console.warn("Server query with date range failed (may need Firestore composite index), falling back gracefully: ", error?.message || error);
    try {
      const fallbackConstraints: QueryConstraint[] = [
        where("dohId", "==", dohId)
      ];
      if (cleanPlatoon) {
        fallbackConstraints.push(where("involvedPlatoons", "array-contains", cleanPlatoon));
      }
      const fallbackQ = query(collection(db, 'logs'), ...fallbackConstraints);
      const querySnapshot = await getDocs(fallbackQ);
      const logs: LogEvent[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as LogEvent;
        if (data.timestamp && data.timestamp.seconds >= startTimestamp.seconds && data.timestamp.seconds <= endTimestamp.seconds) {
          logs.push({ id: docSnap.id, ...data });
        }
      });
      return logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    } catch (fallbackError: any) {
      console.warn("Fallback query failed, querying by dohId: ", fallbackError?.message || fallbackError);
      const dohQ = query(collection(db, 'logs'), where("dohId", "==", dohId));
      const querySnapshot = await getDocs(dohQ);
      const logs: LogEvent[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as LogEvent;
        const matchesPlatoon = !cleanPlatoon || data.platoon === cleanPlatoon || Boolean(data.involvedPlatoons?.includes(cleanPlatoon));
        const matchesTime = data.timestamp && data.timestamp.seconds >= startTimestamp.seconds && data.timestamp.seconds <= endTimestamp.seconds;
        if (matchesPlatoon && matchesTime) {
          logs.push({ id: docSnap.id, ...data });
        }
      });
      return logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    }
  }
};

export const getDeviceLogs = async (deviceId: string): Promise<LogEvent[]> => {
  try {
    const q = query(collection(db, 'logs'), where("deviceId", "==", deviceId));
    const querySnapshot = await getDocs(q);
    const logs: LogEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as LogEvent);
    });
    return logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
  } catch (error) {
    console.error("Error getting device logs: ", error);
    throw error;
  }
};
