import { collection, addDoc, getDocs, getDoc, query, where, Timestamp, orderBy, deleteDoc, doc, updateDoc, deleteField, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';
import { PLUGOT_WITH_UNASSIGNED } from '../constants/data';

export interface Device {
  id?: string;
  type: string;
  tsadiNumber: string;
  assignment: string;
  location?: string;
  dohId?: string;
  lastChecked?: Timestamp;
  lastVerifiedDohId?: string;
  verifiedBy?: string;
}

export interface LogEvent {
  id?: string;
  deviceId?: string;
  tsadiNumber: string;
  action: 'CREATE' | 'TRANSFER' | 'CHECKED' | 'DELETE' | 'UPDATE';
  user: string;
  details: string;
  timestamp: Timestamp;
}

export interface VerificationSession {
  id?: string;
  dohId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  globalStatus: 'pending' | 'active' | 'archived';
  platoons: {
    [platoonName: string]: {
      status: 'active' | 'completed';
      startedAt: Timestamp;
    }
  };
  verifiedDevices: {
    [deviceId: string]: {
      verifiedAt: Timestamp;
      verifiedBy: string;
    }
  };
}

export interface VerificationHistory {
  id?: string;
  dohId: string;
  date: string;
  overallProgress: string;
  platoonBreakdown: {
    [platoon: string]: string; // e.g. "8/10"
  };
  status: 'בוצע' | 'לא הושלם';
  missingDevices?: {
    id: string;
    type: string;
    tsadiNumber: string;
    assignment: string;
    location?: string;
  }[];
  archivedAt: Timestamp;
}

export interface BattalionMetadata {
  equipmentTypes: string[];
  platoons: string[];
  locations: {
    [platoon: string]: string[];
  };
}

export const addDevice = async (device: Omit<Device, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'devices'), {
      ...device,
      lastChecked: Timestamp.now()
    });
    
    await logEvent({
      deviceId: docRef.id,
      tsadiNumber: device.tsadiNumber,
      action: 'CREATE',
      user: 'קשר"ג',
      details: `נוצר ושויך ל-${device.assignment}${device.location ? ` (${device.location})` : ''}`
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error adding device: ", error);
    throw error;
  }
};

export const getDevicesByPlatoon = async (platoonName: string): Promise<Device[]> => {
  try {
    const q = query(collection(db, 'devices'), where("assignment", "==", platoonName));
    const querySnapshot = await getDocs(q);
    const devices: Device[] = [];
    querySnapshot.forEach((doc) => {
      devices.push({ id: doc.id, ...doc.data() } as Device);
    });
    return devices;
  } catch (error) {
    console.error("Error getting devices: ", error);
    throw error;
  }
};

export const getDevicesByPlatoonAndDohId = async (platoonName: string, dohId: string): Promise<Device[]> => {
  try {
    const q = query(
      collection(db, 'devices'), 
      where("assignment", "==", platoonName),
      where("dohId", "==", dohId)
    );
    const querySnapshot = await getDocs(q);
    const devices: Device[] = [];
    querySnapshot.forEach((doc) => {
      devices.push({ id: doc.id, ...doc.data() } as Device);
    });
    return devices;
  } catch (error) {
    console.error("Error getting devices by platoon and dohId: ", error);
    throw error;
  }
};

export const getAllDevices = async (dohId: string): Promise<Device[]> => {
  try {
    const q = query(collection(db, 'devices'), where("dohId", "==", dohId));
    const querySnapshot = await getDocs(q);
    const devices: Device[] = [];
    querySnapshot.forEach((doc) => {
      devices.push({ id: doc.id, ...doc.data() } as Device);
    });
    return devices;
  } catch (error) {
    console.error("Error getting all devices: ", error);
    throw error;
  }
};

export const getAllPlatoons = async (): Promise<string[]> => {
  return [...PLUGOT_WITH_UNASSIGNED];
};

export const logEvent = async (event: Omit<LogEvent, 'id' | 'timestamp'>) => {
  try {
    const docRef = await addDoc(collection(db, 'logs'), {
      ...event,
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
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as LogEvent);
    });
    return logs;
  } catch (error) {
    console.error("Error getting logs: ", error);
    throw error;
  }
};

export const getDeviceLogs = async (deviceId: string): Promise<LogEvent[]> => {
  try {
    const q = query(collection(db, 'logs'), where("deviceId", "==", deviceId));
    const querySnapshot = await getDocs(q);
    const logs: LogEvent[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as LogEvent);
    });
    // Sort locally to avoid composite index requirement
    return logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
  } catch (error) {
    console.error("Error getting device logs: ", error);
    throw error;
  }
};

export const deleteDevice = async (deviceId: string) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    
    if (snap.exists()) {
      const data = snap.data() as Device;
      await logEvent({
        deviceId,
        tsadiNumber: data.tsadiNumber,
        action: 'DELETE',
        user: 'קשר"ג',
        details: `המכשיר נמחק מהמערכת`
      });
    }
    
    await deleteDoc(deviceRef);
  } catch (error) {
    console.error("Error deleting device: ", error);
    throw error;
  }
};

export const updateDeviceAssignmentAndLocation = async (deviceId: string, newPlatoon: string, newLocation?: string) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    
    let oldDetails = '';
    let tsadi = '';
    let dohId = '';
    
    if (snap.exists()) {
      const data = snap.data() as Device;
      oldDetails = `${data.assignment}${data.location ? ` (${data.location})` : ''}`;
      tsadi = data.tsadiNumber;
      dohId = data.dohId || '';
    }
    
    const updateData: any = { assignment: newPlatoon };
    if (newLocation !== undefined) {
      updateData.location = newLocation;
    }
    await updateDoc(deviceRef, updateData);
    
    const newDetails = `${newPlatoon}${newLocation ? ` (${newLocation})` : ''}`;
    
    if (tsadi) {
      await logEvent({
        deviceId,
        tsadiNumber: tsadi,
        action: 'TRANSFER',
        user: 'קשר"ג',
        details: `הועבר מ-${oldDetails} אל ${newDetails}`
      });
    }

    if (dohId) {
      const activeSession = await getActiveSession(dohId);
      if (activeSession && activeSession.id && activeSession.verifiedDevices && activeSession.verifiedDevices[deviceId]) {
        const sessionRef = doc(db, 'verificationSessions', activeSession.id);
        await updateDoc(sessionRef, {
          [`verifiedDevices.${deviceId}`]: deleteField()
        });
      }
    }
    
  } catch (error) {
    console.error("Error updating device assignment: ", error);
    throw error;
  }
};

export const updateDeviceLocation = async (deviceId: string, newLocation: string) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    
    let oldLocation = '';
    let tsadi = '';
    
    if (snap.exists()) {
      const data = snap.data() as Device;
      oldLocation = data.location || 'ללא מיקום';
      tsadi = data.tsadiNumber;
    }
    
    await updateDoc(deviceRef, { location: newLocation });
    
    if (tsadi) {
      await logEvent({
        deviceId,
        tsadiNumber: tsadi,
        action: 'UPDATE',
        user: 'כשפל',
        details: `מיקום עודכן מ-${oldLocation} אל ${newLocation || 'ללא מיקום'}`
      });
    }
  } catch (error) {
    console.error("Error updating device location: ", error);
    throw error;
  }
};

export const getDailyDocId = (dohId: string) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${dohId}_${year}-${month}-${day}`;
};

export const getActiveSession = async (dohId: string): Promise<VerificationSession | null> => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return null;
    
    const session = { id: snap.id, ...snap.data() } as VerificationSession;
    
    // We consider it active if globalStatus is active OR if any platoon is active/completed
    if (session.globalStatus === 'archived') return null;
    
    return session;
  } catch (error) {
    console.error("Error getting active session: ", error);
    return null;
  }
};

export const startKashpalSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().globalStatus === 'archived') {
      throw new Error('ARCHIVED');
    }

    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    if (snap.exists()) {
      // If doc exists, use updateDoc with dot notation to ONLY modify this specific platoon
      await updateDoc(docRef, {
        [`platoons.${platoon}.status`]: 'active',
        [`platoons.${platoon}.startedAt`]: Timestamp.fromDate(now)
      });
    } else {
      // If doc doesn't exist, create it cleanly
      const initialData = {
        dohId,
        globalStatus: 'pending',
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(endOfDay),
        platoons: {
          [platoon]: {
            status: 'active',
            startedAt: Timestamp.fromDate(now)
          }
        }
      };
      await setDoc(docRef, initialData);
    }
    
    return docId;
  } catch (error: any) {
    if (error.message !== 'ARCHIVED') {
      console.error("Error starting kashpal session: ", error);
    }
    throw error;
  }
};

export const endKashpalSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        [`platoons.${platoon}.status`]: 'completed'
      });
    }
  } catch (error) {
    console.error("Error ending kashpal session: ", error);
    throw error;
  }
};

export const startGlobalSession = async (dohId: string, allPlatoons: string[]) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    const snap = await getDoc(docRef);
    
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    let existingPlatoons = {};
    if (snap.exists()) {
      existingPlatoons = (snap.data() as VerificationSession).platoons || {};
    }
    
    const platoonsUpdate: Record<string, any> = {};
    for (const p of allPlatoons) {
      if (!existingPlatoons[p as keyof typeof existingPlatoons]) {
        platoonsUpdate[p] = {
          status: 'active',
          startedAt: Timestamp.fromDate(now)
        };
      }
    }
    
    const partialData: any = {
      dohId,
      globalStatus: 'active',
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(endOfDay)
    };
    
    if (Object.keys(platoonsUpdate).length > 0) {
      partialData.platoons = platoonsUpdate;
    }
    
    await setDoc(docRef, partialData, { merge: true });
    return docId;
  } catch (error) {
    console.error("Error creating global session: ", error);
    throw error;
  }
};

export const verifyDevice = async (sessionId: string, deviceId: string, user: string) => {
  try {
    const sessionRef = doc(db, 'verificationSessions', sessionId);
    await updateDoc(sessionRef, {
      [`verifiedDevices.${deviceId}`]: {
        verifiedAt: Timestamp.now(),
        verifiedBy: user
      }
    });

    const deviceRef = doc(db, 'devices', deviceId);
    await updateDoc(deviceRef, {
      lastChecked: Timestamp.now(),
      verifiedBy: user
    });
  } catch (error) {
    console.error("Error verifying device: ", error);
    throw error;
  }
};

export const archiveSession = async (session: VerificationSession, devices: Device[]) => {
  if (!session.id) return;
  
  try {
    const platoonTotals: Record<string, number> = {};
    const platoonVerified: Record<string, number> = {};
    let totalDevices = 0;
    let verifiedCount = 0;
    const missingDevices: NonNullable<VerificationHistory['missingDevices']> = [];

    devices.forEach(d => {
      const p = d.assignment || 'ללא שיוך';
      platoonTotals[p] = (platoonTotals[p] || 0) + 1;
      totalDevices++;
      
      if (d.id && session.verifiedDevices?.[d.id]) {
        platoonVerified[p] = (platoonVerified[p] || 0) + 1;
        verifiedCount++;
      } else if (d.id) {
        missingDevices.push({
          id: d.id,
          type: d.type,
          tsadiNumber: d.tsadiNumber,
          assignment: d.assignment,
          location: d.location
        });
      }
    });

    const overallProgress = totalDevices > 0 ? `${verifiedCount}/${totalDevices} (${Math.round((verifiedCount / totalDevices) * 100)}%)` : '0/0 (0%)';
    
    const platoonBreakdown: Record<string, string> = {};
    Object.keys(platoonTotals).forEach(p => {
      const verified = platoonVerified[p] || 0;
      const total = platoonTotals[p];
      platoonBreakdown[p] = `${verified}/${total} (${Math.round((verified / total) * 100)}%)`;
    });

    const dateStr = session.createdAt.toDate().toLocaleDateString('he-IL');
    const isComplete = verifiedCount === totalDevices && totalDevices > 0;
    const historyStatus = isComplete ? 'בוצע' : 'לא הושלם';

    const historyData: Omit<VerificationHistory, 'id'> = {
      dohId: session.dohId,
      date: dateStr,
      overallProgress,
      platoonBreakdown,
      status: historyStatus,
      ...(isComplete ? {} : { missingDevices }),
      archivedAt: Timestamp.now()
    };

    await addDoc(collection(db, 'verificationHistory'), historyData);

    const sessionRef = doc(db, 'verificationSessions', session.id);
    await updateDoc(sessionRef, { globalStatus: 'archived' });

  } catch (error) {
    console.error("Error archiving session: ", error);
    throw error;
  }
};

export const getHistoryLogs = async (dohId: string): Promise<VerificationHistory[]> => {
  try {
    const q = query(
      collection(db, 'verificationHistory'),
      where('dohId', '==', dohId)
    );
    const querySnapshot = await getDocs(q);
    const logs: VerificationHistory[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as VerificationHistory);
    });
    // Sort locally to avoid composite index requirement
    return logs.sort((a, b) => b.archivedAt.seconds - a.archivedAt.seconds);
  } catch (error) {
    console.error("Error getting history logs: ", error);
    return [];
  }
};

export const deleteHistoryLog = async (logId: string) => {
  try {
    const logRef = doc(db, 'verificationHistory', logId);
    await deleteDoc(logRef);
  } catch (error) {
    console.error("Error deleting history log: ", error);
    throw error;
  }
};

export const resetSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, 'verificationSessions', sessionId);
    
    // Fetch the current session to get the platoons
    const docSnap = await getDoc(sessionRef);
    if (!docSnap.exists()) return;
    
    const sessionData = docSnap.data();
    const existingPlatoons = sessionData.platoons || {};
    
    // Reset all platoons to 'active'
    const updatedPlatoons: any = {};
    for (const p in existingPlatoons) {
      updatedPlatoons[p] = {
        ...existingPlatoons[p],
        status: 'active'
      };
    }
    
    await updateDoc(sessionRef, { 
      verifiedDevices: {},
      platoons: updatedPlatoons
    });
  } catch (error) {
    console.error("Error resetting session: ", error);
    throw error;
  }
};

export const fetchMetadata = async (): Promise<BattalionMetadata | null> => {
  try {
    const docRef = doc(db, 'battalion_settings', 'metadata');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as BattalionMetadata;
    }
    return null;
  } catch (error) {
    console.error("Error fetching metadata: ", error);
    return null;
  }
};

export const learnMetadata = async (
  category: 'equipment' | 'platoon' | 'location',
  value: string,
  platoonContext?: string
) => {
  try {
    const docRef = doc(db, 'battalion_settings', 'metadata');
    const snap = await getDoc(docRef);
    
    // If the document doesn't exist yet, we create it with empty defaults
    if (!snap.exists()) {
      await setDoc(docRef, {
        equipmentTypes: [],
        platoons: [],
        locations: {}
      });
    }

    if (category === 'equipment') {
      await updateDoc(docRef, {
        equipmentTypes: arrayUnion(value)
      });
    } else if (category === 'platoon') {
      await updateDoc(docRef, {
        platoons: arrayUnion(value)
      });
    } else if (category === 'location') {
      const key = platoonContext || '__default';
      await updateDoc(docRef, {
        [`locations.${key}`]: arrayUnion(value)
      });
    }
  } catch (error) {
    console.error(`Error learning new metadata for ${category}: `, error);
  }
};
