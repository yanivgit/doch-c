import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  Timestamp, 
  deleteDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../config';
import { PLUGOT_WITH_UNASSIGNED } from '../../constants/data';
import { Device } from '../../types';
import { logEvent } from './logs.service';
import { getActiveSession } from './verifications.service';
import { sanitizeInput, sanitizeTsadi, isValidTsadi, MAX_LENGTHS } from '../../utils/security';

export const addDevice = async (device: Omit<Device, 'id'>) => {
  try {
    const cleanTsadi = sanitizeTsadi(device.tsadiNumber);
    if (!cleanTsadi || !isValidTsadi(cleanTsadi)) {
      throw new Error("מספר צ' אינו תקין.");
    }

    const cleanType = sanitizeInput(device.type, MAX_LENGTHS.DEVICE_TYPE) || 'כללי';
    const cleanAssignment = sanitizeInput(device.assignment, MAX_LENGTHS.PLATOON) || 'מחלקת קשר';
    const cleanLocation = sanitizeInput(device.location, MAX_LENGTHS.LOCATION);
    const cleanDohId = sanitizeInput(device.dohId, 100);

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
    querySnapshot.forEach((docSnap) => {
      devices.push({ id: docSnap.id, ...docSnap.data() } as Device);
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
    querySnapshot.forEach((docSnap) => {
      devices.push({ id: docSnap.id, ...docSnap.data() } as Device);
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
    querySnapshot.forEach((docSnap) => {
      devices.push({ id: docSnap.id, ...docSnap.data() } as Device);
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
      querySnapshot.forEach((docSnap) => {
        devices.push({ id: docSnap.id, ...docSnap.data() } as Device);
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
      querySnapshot.forEach((docSnap) => {
        devices.push({ id: docSnap.id, ...docSnap.data() } as Device);
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

export const deleteDevice = async (deviceId: string) => {
  try {
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      throw new Error("מזהה מכשיר אינו תקין למחיקה.");
    }
    const cleanId = sanitizeInput(deviceId, 120);
    const deviceRef = doc(db, 'devices', cleanId);
    const snap = await getDoc(deviceRef);
    
    if (snap.exists()) {
      const data = snap.data() as Device;
      await logEvent({
        deviceId: cleanId,
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
    
    const cleanPlatoon = sanitizeInput(newPlatoon, MAX_LENGTHS.PLATOON);
    const cleanLocation = newLocation !== undefined ? sanitizeInput(newLocation, MAX_LENGTHS.LOCATION) : undefined;
    const cleanUser = sanitizeInput(user || 'קשר"ג', 50);

    const updateData: any = { assignment: cleanPlatoon };
    if (cleanLocation !== undefined) {
      updateData.location = cleanLocation;
    }
    await updateDoc(deviceRef, updateData);
    
    const newDetails = `${cleanPlatoon}${cleanLocation ? ` (${cleanLocation})` : ''}`;
    
    if (tsadi) {
      const involvedPlatoons = [oldPlatoon, cleanPlatoon].filter(p => p && p.trim().length > 0);
      await logEvent({
        deviceId,
        tsadiNumber: tsadi,
        action: 'TRANSFER',
        user: cleanUser,
        details: `הועבר מ-${oldDetails} אל ${newDetails}`,
        platoon: cleanPlatoon,
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
              platoon: cleanPlatoon
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
    const cleanLocation = sanitizeInput(newLocation, MAX_LENGTHS.LOCATION);
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
    
    await updateDoc(deviceRef, { location: cleanLocation });
    
    if (tsadi) {
      await logEvent({
        deviceId,
        tsadiNumber: tsadi,
        action: 'UPDATE',
        user: 'קשפ"ל',
        details: `מיקום עודכן מ-${oldLocation} אל ${cleanLocation || 'ללא מיקום'}`,
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
