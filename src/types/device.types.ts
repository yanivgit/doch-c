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
}
