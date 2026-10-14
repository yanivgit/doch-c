import { 
  collection, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  Timestamp, 
  doc, 
  updateDoc, 
  deleteField 
} from 'firebase/firestore';
import { db } from '../config';
import { Device, DeviceFaultStatus } from '../../types';
import { logEvent } from './logs.service';

export const updateDeviceFaultStatus = async (
  deviceId: string, 
  faultStatus: DeviceFaultStatus,
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
        details: `המכשיר תוקן וחזר לכשירות (${data.type}) צ' ${data.tsadiNumber}`,
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

export const markDeviceAsFixed = async (
  deviceId: string,
  user: string
) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);
    if (!snap.exists()) {
      throw new Error('DEVICE_NOT_FOUND');
    }
    const data = snap.data() as Device;

    await updateDoc(deviceRef, {
      faultStatus: deleteField(),
      faultReportedAt: deleteField(),
      faultReportedBy: deleteField(),
      faultNotes: deleteField(),
      lastChecked: Timestamp.now()
    });

    await logEvent({
      deviceId,
      tsadiNumber: data.tsadiNumber,
      action: 'UPDATE',
      user,
      details: `המכשיר תוקן וחזר לכשירות (${data.type}) צ' ${data.tsadiNumber}`,
      platoon: data.assignment,
      involvedPlatoons: data.assignment ? [data.assignment] : [],
      dohId: data.dohId
    });
  } catch (error) {
    console.error("Error marking device as fixed: ", error);
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
