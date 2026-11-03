import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  Timestamp, 
  deleteDoc, 
  deleteField,
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
    const cleanNotes = device.notes ? sanitizeInput(device.notes, MAX_LENGTHS.NOTES) : undefined;
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
      const existing = querySnapshot.docs[0].data() as Device;
      throw new Error(`מכשיר עם צ' זה כבר קיים במצבת הגדוד (${existing.type || 'מכשיר'} ב-${existing.assignment || 'ללא שיוך'}).`);
    }

    const faultStatus = device.faultStatus || null;
    const deviceDataToSave: any = {
      ...device,
      tsadiNumber: cleanTsadi,
      faultStatus,
      lastChecked: Timestamp.now()
    };

    if (cleanNotes !== undefined) {
      deviceDataToSave.notes = cleanNotes;
    }

    if (device.linkedDeviceId) {
      deviceDataToSave.linkedDeviceId = sanitizeInput(device.linkedDeviceId, 120);
    }
    if (device.linkedTsadi) {
      deviceDataToSave.linkedTsadi = sanitizeTsadi(device.linkedTsadi);
    }
    if (device.linkedType) {
      deviceDataToSave.linkedType = sanitizeInput(device.linkedType, 60);
    }

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
      if (data.linkedDeviceId) {
        try {
          const linkedRef = doc(db, 'devices', data.linkedDeviceId);
          await updateDoc(linkedRef, {
            linkedDeviceId: deleteField(),
            linkedTsadi: deleteField(),
            linkedType: deleteField()
          });
        } catch (e) {
          console.error("Error unlinking paired device on delete: ", e);
        }
      }

      // If this is a Shaked Kit container, unlink all member devices so they return to available inventory
      if (data.isKit) {
        const memberIds = [data.tel100DeviceId, data.mabanDeviceId, data.tabletDeviceId].filter(Boolean) as string[];
        for (const mId of memberIds) {
          try {
            await updateDoc(doc(db, 'devices', mId), {
              parentKitId: deleteField(),
              kitRole: deleteField()
            });
          } catch (e) {
            console.error("Error unlinking kit member on kit delete:", e);
          }
        }
      }

      // If this device was a member of a kit, clear the slot on the parent kit
      if (data.parentKitId) {
        try {
          const kitRef = doc(db, 'devices', data.parentKitId);
          const kitSnap = await getDoc(kitRef);
          if (kitSnap.exists()) {
            const kitData = kitSnap.data() as Device;
            const updates: any = {};
            if (kitData.tel100DeviceId === cleanId) {
              updates.tel100DeviceId = deleteField();
              updates.tel100Tsadi = deleteField();
            }
            if (kitData.mabanDeviceId === cleanId) {
              updates.mabanDeviceId = deleteField();
              updates.mabanTsadi = deleteField();
            }
            if (kitData.tabletDeviceId === cleanId) {
              updates.tabletDeviceId = deleteField();
              updates.tabletTsadi = deleteField();
            }
            if (Object.keys(updates).length > 0) {
              await updateDoc(kitRef, updates);
            }
          }
        } catch (e) {
          console.error("Error clearing kit slot on member delete:", e);
        }
      }
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
  user?: string,
  notes?: string
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
    if (notes !== undefined) {
      updateData.notes = sanitizeInput(notes, MAX_LENGTHS.NOTES);
    }
    await updateDoc(deviceRef, updateData);

    // If this is a kit, also transfer all kit members to the new platoon & location
    if (snap.exists()) {
      const data = snap.data() as Device;
      if (data.isKit) {
        const memberIds = [data.tel100DeviceId, data.mabanDeviceId, data.tabletDeviceId].filter(Boolean) as string[];
        for (const mId of memberIds) {
          try {
            const memberUpdate: any = { assignment: cleanPlatoon };
            if (cleanLocation !== undefined) {
              memberUpdate.location = cleanLocation;
            }
            await updateDoc(doc(db, 'devices', mId), memberUpdate);
          } catch (e) {
            console.error("Error transferring kit member:", e);
          }
        }
      }
    }
    
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

export const updateDeviceNotes = async (deviceId: string, notes: string) => {
  try {
    const cleanNotes = sanitizeInput(notes, MAX_LENGTHS.NOTES);
    const cleanId = sanitizeInput(deviceId, 120);
    const deviceRef = doc(db, 'devices', cleanId);
    await updateDoc(deviceRef, { notes: cleanNotes });
  } catch (error) {
    console.error("Error updating device notes: ", error);
    throw error;
  }
};

export const linkDevices = async (
  hostDeviceId: string, 
  mediaDeviceId: string, 
  user?: string
) => {
  try {
    const hostRef = doc(db, 'devices', hostDeviceId);
    const mediaRef = doc(db, 'devices', mediaDeviceId);

    const [hostSnap, mediaSnap] = await Promise.all([
      getDoc(hostRef),
      getDoc(mediaRef)
    ]);

    if (!hostSnap.exists() || !mediaSnap.exists()) {
      throw new Error('אחד מהמכשירים לא נמצא במערכת.');
    }

    const hostData = hostSnap.data() as Device;
    const mediaData = mediaSnap.data() as Device;

    const isAllowedHostType = (type?: string) => {
      if (!type) return false;
      const t = type.toLowerCase();
      return t.includes('מגן') || t.includes('מכלול') || t.includes('אלעד') || t.includes('שן בינה') || t.includes('בינה');
    };

    if (!isAllowedHostType(hostData.type)) {
      throw new Error(`לא ניתן לצמד מדיה למכשיר מסוג "${hostData.type || 'זה'}". צימוד מדיה מותר אך ורק עבור מגן מכלול, אלעד ירוק ושן בינה.`);
    }

    const mediaTypeLower = (mediaData.type || '').toLowerCase();
    if (!mediaTypeLower.includes('מדיה') && !mediaTypeLower.includes('נתיק')) {
      throw new Error(`צ' ${mediaData.tsadiNumber} אינו רשום כמדיה במערכת (${mediaData.type || 'מכשיר כללי'}). לא ניתן לקשרו כמדיה.`);
    }

    // If host was previously linked to another media, unlink that previous media
    if (hostData.linkedDeviceId && hostData.linkedDeviceId !== mediaDeviceId) {
      try {
        const prevMediaRef = doc(db, 'devices', hostData.linkedDeviceId);
        await updateDoc(prevMediaRef, {
          linkedDeviceId: deleteField(),
          linkedTsadi: deleteField(),
          linkedType: deleteField()
        });
      } catch (e) {
        console.error("Error unlinking previous media from host:", e);
      }
    }

    // If media was previously linked to another host, unlink that previous host
    if (mediaData.linkedDeviceId && mediaData.linkedDeviceId !== hostDeviceId) {
      try {
        const prevHostRef = doc(db, 'devices', mediaData.linkedDeviceId);
        await updateDoc(prevHostRef, {
          linkedDeviceId: deleteField(),
          linkedTsadi: deleteField(),
          linkedType: deleteField()
        });
      } catch (e) {
        console.error("Error unlinking previous host from media:", e);
      }
    }

    const mediaUpdates: any = {
      linkedDeviceId: hostDeviceId,
      linkedTsadi: hostData.tsadiNumber,
      linkedType: hostData.type || 'מגן מכלול'
    };
    if (hostData.assignment) {
      mediaUpdates.assignment = hostData.assignment;
    }
    if (hostData.location) {
      mediaUpdates.location = hostData.location;
    }

    // Link both devices symmetrically and align platoon/location
    await Promise.all([
      updateDoc(hostRef, {
        linkedDeviceId: mediaDeviceId,
        linkedTsadi: mediaData.tsadiNumber,
        linkedType: mediaData.type || 'מדיה'
      }),
      updateDoc(mediaRef, mediaUpdates)
    ]);

    // Log the link event
    const cleanUser = sanitizeInput(user || 'קשר"ג', 50);
    await logEvent({
      deviceId: hostDeviceId,
      tsadiNumber: hostData.tsadiNumber,
      action: 'UPDATE',
      user: cleanUser,
      details: `צימוד מדיה: צ' ${mediaData.tsadiNumber} (${mediaData.type}) חוברה ל-צ' ${hostData.tsadiNumber} (${hostData.type})`,
      platoon: hostData.assignment,
      involvedPlatoons: [hostData.assignment, mediaData.assignment].filter(Boolean) as string[],
      dohId: hostData.dohId
    });

  } catch (error) {
    console.error("Error linking devices: ", error);
    throw error;
  }
};

export const unlinkDevices = async (deviceId: string, user?: string) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    if (!snap.exists()) return;

    const data = snap.data() as Device;
    const linkedId = data.linkedDeviceId;

    if (linkedId) {
      try {
        const linkedRef = doc(db, 'devices', linkedId);
        await updateDoc(linkedRef, {
          linkedDeviceId: deleteField(),
          linkedTsadi: deleteField(),
          linkedType: deleteField()
        });
      } catch (e) {
        console.error("Error unlinking paired device:", e);
      }
    }

    await updateDoc(deviceRef, {
      linkedDeviceId: deleteField(),
      linkedTsadi: deleteField(),
      linkedType: deleteField()
    });

    const cleanUser = sanitizeInput(user || 'קשר"ג', 50);
    await logEvent({
      deviceId,
      tsadiNumber: data.tsadiNumber,
      action: 'UPDATE',
      user: cleanUser,
      details: `ניתוק צימוד: צ' ${data.tsadiNumber} נותק מ-צ' ${data.linkedTsadi || 'מכשיר מקושר'}`,
      platoon: data.assignment,
      involvedPlatoons: data.assignment ? [data.assignment] : [],
      dohId: data.dohId
    });

  } catch (error) {
    console.error("Error unlinking devices: ", error);
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

export interface ShakedKitSlotInput {
  mode: 'new' | 'existing';
  tsadiNumber: string;
  deviceId?: string;
}

export interface CreateShakedKitInput {
  kitName?: string;
  assignment: string;
  location?: string;
  dohId?: string;
  notes?: string;
  tel100?: ShakedKitSlotInput;
  maban?: ShakedKitSlotInput;
  tablet?: ShakedKitSlotInput;
}

export const createShakedKit = async (input: CreateShakedKitInput, user?: string): Promise<string> => {
  try {
    const cleanKitName = sanitizeInput(input.kitName?.trim() || 'ערכת שקד', 100);
    const cleanAssignment = sanitizeInput(input.assignment, MAX_LENGTHS.PLATOON) || 'מחלקת קשר';
    const cleanLocation = input.location ? sanitizeInput(input.location, MAX_LENGTHS.LOCATION) : '';
    const cleanDohId = input.dohId ? sanitizeInput(input.dohId, 100) : '';
    const cleanUser = sanitizeInput(user || 'קשר"ג', 50);

    // 1. Create the kit container doc
    const kitData: any = {
      type: 'ערכת שקד',
      tsadiNumber: cleanKitName,
      assignment: cleanAssignment,
      location: cleanLocation,
      dohId: cleanDohId,
      isKit: true,
      kitName: cleanKitName,
    };
    if (input.notes?.trim()) {
      kitData.notes = sanitizeInput(input.notes.trim(), 500);
    }

    const kitRef = await addDoc(collection(db, 'devices'), kitData);
    const kitId = kitRef.id;

    const kitUpdates: any = {};
    const createdTsadiList: string[] = [];

    // Helper to process a member slot
    const processSlot = async (
      slot: ShakedKitSlotInput | undefined, 
      expectedType: string, 
      roleKey: 'tel100' | 'maban' | 'tablet'
    ) => {
      if (!slot || !slot.tsadiNumber.trim()) return;
      const cleanTsadi = sanitizeTsadi(slot.tsadiNumber);
      if (!cleanTsadi) return;

      let memberId = slot.deviceId;

      if (slot.mode === 'new' || !memberId) {
        // Create new device document
        memberId = await addDevice({
          type: expectedType,
          tsadiNumber: cleanTsadi,
          assignment: cleanAssignment,
          location: cleanLocation,
          dohId: cleanDohId,
          parentKitId: kitId,
          kitRole: roleKey
        });
      } else {
        // Link existing device
        await updateDoc(doc(db, 'devices', memberId), {
          parentKitId: kitId,
          kitRole: roleKey,
          assignment: cleanAssignment,
          location: cleanLocation
        });
      }

      kitUpdates[`${roleKey}DeviceId`] = memberId;
      kitUpdates[`${roleKey}Tsadi`] = cleanTsadi;
      createdTsadiList.push(`${expectedType} צ׳ ${cleanTsadi}`);
    };

    await processSlot(input.tel100, 'טל 100', 'tel100');
    await processSlot(input.maban, 'מבן', 'maban');
    await processSlot(input.tablet, 'טאבלט', 'tablet');

    if (Object.keys(kitUpdates).length > 0) {
      await updateDoc(kitRef, kitUpdates);
    }

    await logEvent({
      deviceId: kitId,
      tsadiNumber: cleanKitName,
      action: 'CREATE',
      user: cleanUser,
      details: `הוקמה ${cleanKitName} ב-${cleanAssignment}${cleanLocation ? ` (${cleanLocation})` : ''} עם פריטים: ${createdTsadiList.join(', ') || 'ללא פריטים'}`,
      platoon: cleanAssignment,
      involvedPlatoons: [cleanAssignment],
      dohId: cleanDohId
    });

    return kitId;
  } catch (error) {
    console.error("Error creating Shaked kit:", error);
    throw error;
  }
};

export const unlinkKitMember = async (
  kitId: string, 
  role: 'tel100' | 'maban' | 'tablet', 
  user?: string
) => {
  try {
    const kitRef = doc(db, 'devices', kitId);
    const kitSnap = await getDoc(kitRef);
    if (!kitSnap.exists()) return;

    const kitData = kitSnap.data() as Device;
    const memberId = kitData[`${role}DeviceId` as keyof Device] as string | undefined;
    const memberTsadi = kitData[`${role}Tsadi` as keyof Device] as string | undefined;

    if (memberId) {
      try {
        await updateDoc(doc(db, 'devices', memberId), {
          parentKitId: deleteField(),
          kitRole: deleteField()
        });
      } catch (e) {
        console.error("Error unlinking member device:", e);
      }
    }

    await updateDoc(kitRef, {
      [`${role}DeviceId`]: deleteField(),
      [`${role}Tsadi`]: deleteField()
    });

    const cleanUser = sanitizeInput(user || 'קשר"ג', 50);
    await logEvent({
      deviceId: kitId,
      tsadiNumber: kitData.kitName || kitData.tsadiNumber,
      action: 'UPDATE',
      user: cleanUser,
      details: `הוסר פריט מהערכה: צ׳ ${memberTsadi || memberId}`,
      platoon: kitData.assignment,
      involvedPlatoons: kitData.assignment ? [kitData.assignment] : [],
      dohId: kitData.dohId
    });
  } catch (error) {
    console.error("Error unlinking kit member:", error);
    throw error;
  }
};

export const linkKitMember = async (
  kitId: string, 
  role: 'tel100' | 'maban' | 'tablet', 
  memberDeviceId: string, 
  user?: string
) => {
  try {
    const kitRef = doc(db, 'devices', kitId);
    const memberRef = doc(db, 'devices', memberDeviceId);

    const [kitSnap, memberSnap] = await Promise.all([
      getDoc(kitRef),
      getDoc(memberRef)
    ]);

    if (!kitSnap.exists() || !memberSnap.exists()) {
      throw new Error('אחד מהמסמכים לא נמצא.');
    }

    const kitData = kitSnap.data() as Device;
    const memberData = memberSnap.data() as Device;

    // Unlink old device in this slot if exists
    const oldMemberId = kitData[`${role}DeviceId` as keyof Device] as string | undefined;
    if (oldMemberId && oldMemberId !== memberDeviceId) {
      try {
        await updateDoc(doc(db, 'devices', oldMemberId), {
          parentKitId: deleteField(),
          kitRole: deleteField()
        });
      } catch (e) {
        console.error("Error unlinking previous kit slot device:", e);
      }
    }

    // Link new member device and sync platoon & location
    await Promise.all([
      updateDoc(memberRef, {
        parentKitId: kitId,
        kitRole: role,
        assignment: kitData.assignment,
        location: kitData.location || ''
      }),
      updateDoc(kitRef, {
        [`${role}DeviceId`]: memberDeviceId,
        [`${role}Tsadi`]: memberData.tsadiNumber
      })
    ]);

    const cleanUser = sanitizeInput(user || 'קשר"ג', 50);
    await logEvent({
      deviceId: kitId,
      tsadiNumber: kitData.kitName || kitData.tsadiNumber,
      action: 'UPDATE',
      user: cleanUser,
      details: `חובר פריט לערכה: ${memberData.type} צ׳ ${memberData.tsadiNumber}`,
      platoon: kitData.assignment,
      involvedPlatoons: [kitData.assignment, memberData.assignment].filter(Boolean) as string[],
      dohId: kitData.dohId
    });
  } catch (error) {
    console.error("Error linking kit member:", error);
    throw error;
  }
};
