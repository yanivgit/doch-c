import { Timestamp } from 'firebase/firestore';

export type DeviceFaultStatus = 'inspection' | 'replacement' | null;

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
  faultStatus?: DeviceFaultStatus;
  faultReportedAt?: Timestamp;
  faultReportedBy?: string;
  faultNotes?: string;
  notes?: string;
  linkedDeviceId?: string;
  linkedTsadi?: string;
  linkedType?: string;
  isKit?: boolean;
  kitName?: string;
  parentKitId?: string;
  kitRole?: 'tel100' | 'maban' | 'tablet' | string;
  tel100DeviceId?: string;
  tel100Tsadi?: string;
  mabanDeviceId?: string;
  mabanTsadi?: string;
  tabletDeviceId?: string;
  tabletTsadi?: string;
}
