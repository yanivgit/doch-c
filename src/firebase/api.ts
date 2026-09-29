import { collection, addDoc, getDocs, getDoc, query, where, Timestamp, orderBy, deleteDoc, doc, updateDoc, deleteField, setDoc, arrayUnion, onSnapshot, Unsubscribe, QueryConstraint, serverTimestamp } from 'firebase/firestore';
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
  faultStatus?: 'inspection' | 'replacement' | null;
  faultReportedAt?: Timestamp;
  faultReportedBy?: string;
  faultNotes?: string;
}

export interface LogEvent {
  id?: string;
  deviceId?: string;
  tsadiNumber: string;
  action: 'CREATE' | 'TRANSFER' | 'CHECKED' | 'DELETE' | 'UPDATE';
  user: string;
  details: string;
  platoon?: string;
  involvedPlatoons?: string[];
  timestamp: Timestamp;
  dohId?: string;
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
      completedAt?: Timestamp;
    }
  };
  verifiedDevices: {
    [deviceId: string]: {
      verifiedAt: Timestamp;
      verifiedBy: string;
    }
  };
  archivedAt?: Timestamp;
  autoArchivedIncomplete?: boolean;
  completionNotes?: string;
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
  autoArchivedIncomplete?: boolean;
  completionNotes?: string;
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
    const cleanTsadi = device.tsadiNumber?.trim() || '';
    if (!cleanTsadi) {
      throw new Error("מספר צ' אינו תקין.");
    }

    // Check for duplicate Tsadi number in the current dohId
    let q;
    if (device.dohId) {
      q = query(
        collection(db, 'devices'),
        where("tsadiNumber", "==", cleanTsadi),
        where("dohId", "==", device.dohId)
      );
    } else {
      q = query(
        collection(db, 'devices'),
        where("tsadiNumber", "==", cleanTsadi)
      );
    }

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      throw new Error("מכשיר עם צ' זה כבר קיים במצבת הגדוד.");
    }

    const faultStatus = device.faultStatus || null;
    const deviceDataToSave: any = {
      ...device,
      tsadiNumber: cleanTsadi,
      faultStatus,
      lastChecked: Timestamp.now()
    };

    if (faultStatus) {
      deviceDataToSave.faultReportedAt = Timestamp.now();
      deviceDataToSave.faultReportedBy = 'קשר"ג';
      deviceDataToSave.faultNotes = 'הוגדר כתקול בעת רישום המכשיר';
    }

    const docRef = await addDoc(collection(db, 'devices'), deviceDataToSave);
    
    const faultDetails = faultStatus ? ` [הוגדר כ${faultStatus === 'replacement' ? 'דורש החלפה' : 'דרושה בדיקה'}]` : '';
    await logEvent({
      deviceId: docRef.id,
      tsadiNumber: cleanTsadi,
      action: 'CREATE',
      user: 'קשר"ג',
      details: `נוצר ושויך ל-${device.assignment}${device.location ? ` (${device.location})` : ''}${faultDetails}`,
      platoon: device.assignment,
      involvedPlatoons: device.assignment ? [device.assignment] : [],
      dohId: device.dohId
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

export const subscribeToDevicesByPlatoonAndDohId = (
  platoonName: string,
  dohId: string,
  onUpdate: (devices: Device[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'devices'),
    where("assignment", "==", platoonName),
    where("dohId", "==", dohId)
  );
  return onSnapshot(
    q,
    (querySnapshot) => {
      const devices: Device[] = [];
      querySnapshot.forEach((doc) => {
        devices.push({ id: doc.id, ...doc.data() } as Device);
      });
      onUpdate(devices);
    },
    (error) => {
      console.error("Error subscribing to platoon devices: ", error);
      onError?.(error);
    }
  );
};

export const subscribeToAllDevices = (
  dohId: string,
  onUpdate: (devices: Device[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'devices'),
    where("dohId", "==", dohId)
  );
  return onSnapshot(
    q,
    (querySnapshot) => {
      const devices: Device[] = [];
      querySnapshot.forEach((doc) => {
        devices.push({ id: doc.id, ...doc.data() } as Device);
      });
      onUpdate(devices);
    },
    (error) => {
      console.error("Error subscribing to all devices: ", error);
      onError?.(error);
    }
  );
};

export const getAllPlatoons = async (): Promise<string[]> => {
  return [...PLUGOT_WITH_UNASSIGNED];
};

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
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as LogEvent);
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
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as LogEvent);
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
      querySnapshot.forEach((doc) => {
        const data = doc.data() as LogEvent;
        if (data.timestamp && data.timestamp.seconds >= startTimestamp.seconds && data.timestamp.seconds <= endTimestamp.seconds) {
          logs.push({ id: doc.id, ...data });
        }
      });
      return logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    } catch (fallbackError: any) {
      console.warn("Fallback query failed, querying by dohId: ", fallbackError?.message || fallbackError);
      const dohQ = query(collection(db, 'logs'), where("dohId", "==", dohId));
      const querySnapshot = await getDocs(dohQ);
      const logs: LogEvent[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as LogEvent;
        const matchesPlatoon = !cleanPlatoon || data.platoon === cleanPlatoon || Boolean(data.involvedPlatoons?.includes(cleanPlatoon));
        const matchesTime = data.timestamp && data.timestamp.seconds >= startTimestamp.seconds && data.timestamp.seconds <= endTimestamp.seconds;
        if (matchesPlatoon && matchesTime) {
          logs.push({ id: doc.id, ...data });
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
        details: `המכשיר נמחק מ-${data.assignment || 'ללא שיוך'}`,
        platoon: data.assignment,
        involvedPlatoons: data.assignment ? [data.assignment] : [],
        dohId: data.dohId
      });
    }
    
    await deleteDoc(deviceRef);
  } catch (error) {
    console.error("Error deleting device: ", error);
    throw error;
  }
};

export const updateDeviceAssignmentAndLocation = async (
  deviceId: string, 
  newPlatoon: string, 
  newLocation?: string,
  user?: string
) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    
    let oldDetails = '';
    let oldPlatoon = '';
    let tsadi = '';
    let dohId = '';
    
    if (snap.exists()) {
      const data = snap.data() as Device;
      oldPlatoon = data.assignment || '';
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
      const involvedPlatoons = [oldPlatoon, newPlatoon].filter(p => p && p.trim().length > 0);
      await logEvent({
        deviceId,
        tsadiNumber: tsadi,
        action: 'TRANSFER',
        user: user || 'קשר"ג',
        details: `הועבר מ-${oldDetails} אל ${newDetails}`,
        platoon: newPlatoon,
        involvedPlatoons,
        dohId
      });
    }

    if (dohId) {
      const activeSession = await getActiveSession(dohId);
      if (activeSession && activeSession.id) {
        try {
          const verifiedDocRef = doc(db, 'verificationSessions', activeSession.id, 'verifiedDevices', deviceId);
          const verifiedDocSnap = await getDoc(verifiedDocRef);
          if (verifiedDocSnap.exists()) {
            await updateDoc(verifiedDocRef, {
              platoon: newPlatoon
            });
          }
        } catch (e) {
          console.error("Error updating transferred device in verifiedDevices subcollection:", e);
        }
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
    let assignment = '';
    let dohId = '';
    
    if (snap.exists()) {
      const data = snap.data() as Device;
      oldLocation = data.location || 'ללא מיקום';
      tsadi = data.tsadiNumber;
      assignment = data.assignment || '';
      dohId = data.dohId || '';
    }
    
    await updateDoc(deviceRef, { location: newLocation });
    
    if (tsadi) {
      await logEvent({
        deviceId,
        tsadiNumber: tsadi,
        action: 'UPDATE',
        user: 'קשפ"ל',
        details: `מיקום עודכן מ-${oldLocation} אל ${newLocation || 'ללא מיקום'}`,
        platoon: assignment,
        involvedPlatoons: assignment ? [assignment] : [],
        dohId
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
    const now = new Date();
    if (snap.exists()) {
      await updateDoc(docRef, {
        [`platoons.${platoon}.status`]: 'completed',
        [`platoons.${platoon}.completedAt`]: Timestamp.fromDate(now)
      });
    } else {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      await setDoc(docRef, {
        dohId,
        globalStatus: 'pending',
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(endOfDay),
        platoons: {
          [platoon]: {
            status: 'completed',
            startedAt: Timestamp.fromDate(now),
            completedAt: Timestamp.fromDate(now)
          }
        }
      }, { merge: true });
    }

    await logEvent({
      deviceId: '',
      tsadiNumber: 'כללי',
      action: 'UPDATE',
      user: `קשפ"ל_${platoon}`,
      details: `סיום דו"ח יומי עבור ${platoon}`,
      platoon,
      involvedPlatoons: [platoon],
      dohId
    });
  } catch (error) {
    console.error("Error ending kashpal session: ", error);
    throw error;
  }
};

export const reopenKashpalSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    await updateDoc(docRef, {
      [`platoons.${platoon}.status`]: 'active'
    });

    await logEvent({
      deviceId: '',
      tsadiNumber: 'כללי',
      action: 'UPDATE',
      user: 'קשר"ג',
      details: `פתיחה מחדש של דו"ח יומי עבור ${platoon}`,
      platoon,
      involvedPlatoons: [platoon],
      dohId
    });
  } catch (error) {
    console.error("Error reopening kashpal session: ", error);
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

export const subscribeToVerifiedDevices = (
  sessionId: string,
  onUpdate: (verifiedMap: Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }>) => void,
  onError?: (error: Error) => void,
  platoon?: string
): Unsubscribe => {
  const colRef = collection(db, 'verificationSessions', sessionId, 'verifiedDevices');
  const q = platoon ? query(colRef, where('platoon', '==', platoon)) : colRef;
  return onSnapshot(
    q,
    (querySnapshot) => {
      const verifiedMap: Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }> = {};
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        verifiedMap[docSnap.id] = {
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy || '',
          platoon: data.platoon
        };
      });
      onUpdate(verifiedMap);
    },
    (error) => {
      console.error("Error subscribing to verified devices: ", error);
      onError?.(error);
    }
  );
};

export const getVerifiedDevices = async (
  sessionId: string,
  platoon?: string
): Promise<Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }>> => {
  try {
    const colRef = collection(db, 'verificationSessions', sessionId, 'verifiedDevices');
    const q = platoon ? query(colRef, where('platoon', '==', platoon)) : colRef;
    const snapshot = await getDocs(q);
    const verifiedMap: Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      verifiedMap[docSnap.id] = {
        verifiedAt: data.verifiedAt,
        verifiedBy: data.verifiedBy || '',
        platoon: data.platoon
      };
    });
    return verifiedMap;
  } catch (error) {
    console.error("Error getting verified devices: ", error);
    return {};
  }
};

export const verifyDevice = async (sessionId: string, deviceId: string, user: string, platoon?: string) => {
  try {
    let resolvedPlatoon = platoon;
    if (!resolvedPlatoon && user && user.startsWith('קשפ"ל_')) {
      resolvedPlatoon = user.replace('קשפ"ל_', '');
    }
    const verifiedDeviceRef = doc(db, 'verificationSessions', sessionId, 'verifiedDevices', deviceId);
    const dataToSet: any = {
      verifiedAt: Timestamp.now(),
      timestamp: serverTimestamp(),
      verifiedBy: user
    };
    if (resolvedPlatoon) {
      dataToSet.platoon = resolvedPlatoon;
    }
    await setDoc(verifiedDeviceRef, dataToSet);

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

export const unverifyDevice = async (sessionId: string, deviceId: string) => {
  try {
    const verifiedDeviceRef = doc(db, 'verificationSessions', sessionId, 'verifiedDevices', deviceId);
    await deleteDoc(verifiedDeviceRef);
  } catch (error) {
    console.error("Error unverifying device: ", error);
    throw error;
  }
};

export const archiveSession = async (
  session: VerificationSession, 
  devices: Device[],
  options?: {
    autoArchivedIncomplete?: boolean;
    completionNotes?: string;
  }
) => {
  if (!session.id) return;
  
  try {
    const verifiedMap = session.verifiedDevices && Object.keys(session.verifiedDevices).length > 0
      ? session.verifiedDevices 
      : await getVerifiedDevices(session.id);

    const platoonTotals: Record<string, number> = {};
    const platoonVerified: Record<string, number> = {};
    let totalDevices = 0;
    let verifiedCount = 0;
    const missingDevices: NonNullable<VerificationHistory['missingDevices']> = [];

    devices.forEach(d => {
      const p = d.assignment || 'ללא שיוך';
      platoonTotals[p] = (platoonTotals[p] || 0) + 1;
      totalDevices++;
      
      if (d.id && verifiedMap[d.id]) {
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

    const dateStr = session.createdAt ? session.createdAt.toDate().toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL');
    const isComplete = !options?.autoArchivedIncomplete && verifiedCount === totalDevices && totalDevices > 0;
    const historyStatus = isComplete ? 'בוצע' : 'לא הושלם';

    const historyData: Omit<VerificationHistory, 'id'> = {
      dohId: session.dohId,
      date: dateStr,
      overallProgress,
      platoonBreakdown,
      status: historyStatus,
      ...(isComplete ? {} : { missingDevices }),
      archivedAt: Timestamp.now(),
      ...(options?.autoArchivedIncomplete ? { autoArchivedIncomplete: true } : {}),
      ...(options?.completionNotes ? { completionNotes: options.completionNotes } : {})
    };

    await addDoc(collection(db, 'verificationHistory'), historyData);

    const sessionRef = doc(db, 'verificationSessions', session.id);
    const sessionUpdate: any = { 
      globalStatus: 'archived',
      archivedAt: serverTimestamp()
    };
    if (options?.autoArchivedIncomplete) {
      sessionUpdate.autoArchivedIncomplete = true;
    }
    if (options?.completionNotes) {
      sessionUpdate.completionNotes = options.completionNotes;
    }

    await updateDoc(sessionRef, sessionUpdate);

  } catch (error) {
    console.error("Error archiving session: ", error);
    throw error;
  }
};

export const archiveExpiredSessions = async (dohId: string): Promise<number> => {
  if (!dohId) return 0;
  try {
    let snap;
    try {
      const q = query(
        collection(db, 'verificationSessions'),
        where('dohId', '==', dohId),
        where('globalStatus', 'in', ['active', 'pending'])
      );
      snap = await getDocs(q);
    } catch (queryErr) {
      console.warn("Compound query for verificationSessions failed, falling back to dohId query:", queryErr);
      const fallbackQ = query(
        collection(db, 'verificationSessions'),
        where('dohId', '==', dohId)
      );
      snap = await getDocs(fallbackQ);
    }

    if (snap.empty) return 0;

    const now = Date.now();
    const expiredSessions: VerificationSession[] = [];
    snap.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() } as VerificationSession;
      const isPendingOrActive = data.globalStatus === 'active' || data.globalStatus === 'pending';
      const isExpired = data.expiresAt && data.expiresAt.toMillis() < now;
      if (isPendingOrActive && isExpired) {
        expiredSessions.push(data);
      }
    });

    if (expiredSessions.length === 0) return 0;

    const allDevices = await getAllDevices(dohId);

    for (const session of expiredSessions) {
      await archiveSession(session, allDevices, {
        autoArchivedIncomplete: true,
        completionNotes: 'אורכב אוטומטית בחצות - הדו"ח לא הושלם במלואו'
      });
    }

    return expiredSessions.length;
  } catch (error) {
    console.error("Error archiving expired sessions:", error);
    return 0;
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
      platoons: updatedPlatoons
    });

    // Delete all docs in verifiedDevices subcollection
    const colRef = collection(db, 'verificationSessions', sessionId, 'verifiedDevices');
    const verifiedSnap = await getDocs(colRef);
    const deletePromises = verifiedSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error resetting session: ", error);
    throw error;
  }
};

export const resetPlatoonSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const sessionRef = doc(db, 'verificationSessions', docId);
    
    // 1. Reset platoon status to 'active'
    await updateDoc(sessionRef, {
      [`platoons.${platoon}.status`]: 'active'
    });

    // 2. Delete all docs in verifiedDevices subcollection that belong to this platoon
    const colRef = collection(db, 'verificationSessions', docId, 'verifiedDevices');
    const q = query(colRef, where('platoon', '==', platoon));
    const verifiedSnap = await getDocs(q);
    const deletePromises = verifiedSnap.docs.map(d => deleteDoc(d.ref));
    
    // Also safeguard against any devices assigned to this platoon
    const platoonDevices = await getDevicesByPlatoonAndDohId(platoon, dohId);
    for (const d of platoonDevices) {
      if (d.id) {
        deletePromises.push(deleteDoc(doc(db, 'verificationSessions', docId, 'verifiedDevices', d.id)).catch(() => {}));
      }
    }
    
    await Promise.all(deletePromises);

    // 3. Log event
    await logEvent({
      deviceId: '',
      tsadiNumber: 'כללי',
      action: 'UPDATE',
      user: 'קשר"ג',
      details: `איפוס דו"ח יומי עבור ${platoon}`,
      platoon,
      involvedPlatoons: [platoon],
      dohId
    });
  } catch (error) {
    console.error("Error resetting platoon session: ", error);
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

export const findDeviceByTsadi = async (tsadiNumber: string, dohId?: string): Promise<Device | null> => {
  try {
    const cleanTsadi = tsadiNumber.trim();
    if (!cleanTsadi) return null;

    let q;
    if (dohId) {
      q = query(
        collection(db, 'devices'),
        where("tsadiNumber", "==", cleanTsadi),
        where("dohId", "==", dohId)
      );
    } else {
      q = query(
        collection(db, 'devices'),
        where("tsadiNumber", "==", cleanTsadi)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      // If scoped by dohId and not found, attempt global query as fallback
      if (dohId) {
        const fallbackQ = query(
          collection(db, 'devices'),
          where("tsadiNumber", "==", cleanTsadi)
        );
        const fallbackSnap = await getDocs(fallbackQ);
        if (!fallbackSnap.empty) {
          const docSnap = fallbackSnap.docs[0];
          return { id: docSnap.id, ...docSnap.data() } as Device;
        }
      }
      return null;
    }

    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Device;
  } catch (error) {
    console.error("Error finding device by tsadi: ", error);
    throw error;
  }
};

export const updateDeviceFaultStatus = async (
  deviceId: string, 
  faultStatus: 'inspection' | 'replacement' | null,
  user: string,
  notes?: string
) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    if (!snap.exists()) {
      throw new Error('DEVICE_NOT_FOUND');
    }
    const data = snap.data() as Device;

    if (faultStatus) {
      await updateDoc(deviceRef, {
        faultStatus,
        faultReportedAt: Timestamp.now(),
        faultReportedBy: user,
        faultNotes: notes || ''
      });

      const severityText = faultStatus === 'inspection' 
        ? 'דרושה בדיקת קשר (כתום)' 
        : 'דורש החלפה (אדום)';

      await logEvent({
        deviceId,
        tsadiNumber: data.tsadiNumber,
        action: 'UPDATE',
        user,
        details: `דיווח תקלה למכשיר (${data.type}): ${severityText}${notes ? ` - ${notes}` : ''}`,
        platoon: data.assignment,
        involvedPlatoons: data.assignment ? [data.assignment] : [],
        dohId: data.dohId
      });
    } else {
      await updateDoc(deviceRef, {
        faultStatus: deleteField(),
        faultReportedAt: deleteField(),
        faultReportedBy: deleteField(),
        faultNotes: deleteField()
      });

      await logEvent({
        deviceId,
        tsadiNumber: data.tsadiNumber,
        action: 'UPDATE',
        user,
        details: `תקלה בוטלה / הוסרה למכשיר (${data.type}) צ' ${data.tsadiNumber}`,
        platoon: data.assignment,
        involvedPlatoons: data.assignment ? [data.assignment] : [],
        dohId: data.dohId
      });
    }
  } catch (error) {
    console.error("Error updating fault status: ", error);
    throw error;
  }
};

export const replaceDeviceAtBrigade = async (
  deviceId: string,
  newTsadiNumber: string,
  user: string
) => {
  try {
    const cleanNewTsadi = newTsadiNumber.trim();
    if (!cleanNewTsadi) throw new Error('EMPTY_TSADI');

    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    if (!snap.exists()) {
      throw new Error('DEVICE_NOT_FOUND');
    }
    const data = snap.data() as Device;
    const oldTsadi = data.tsadiNumber;

    // Check duplicate in same dohId
    if (data.dohId) {
      const q = query(
        collection(db, 'devices'),
        where("tsadiNumber", "==", cleanNewTsadi),
        where("dohId", "==", data.dohId)
      );
      const snapDup = await getDocs(q);
      const isDuplicate = snapDup.docs.some(d => d.id !== deviceId);
      if (isDuplicate) {
        throw new Error('DUPLICATE_TSADI');
      }
    }

    await updateDoc(deviceRef, {
      tsadiNumber: cleanNewTsadi,
      faultStatus: deleteField(),
      faultReportedAt: deleteField(),
      faultReportedBy: deleteField(),
      faultNotes: deleteField(),
      lastChecked: Timestamp.now()
    });

    await logEvent({
      deviceId,
      tsadiNumber: cleanNewTsadi,
      action: 'UPDATE',
      user,
      details: `החלפת מכשיר (${data.type}) מול חטיבה: צ' ישן ${oldTsadi} ➔ צ' חדש ${cleanNewTsadi}`,
      platoon: data.assignment,
      involvedPlatoons: data.assignment ? [data.assignment] : [],
      dohId: data.dohId
    });
  } catch (error) {
    console.error("Error replacing device at brigade: ", error);
    throw error;
  }
};
