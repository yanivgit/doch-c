import { Timestamp } from 'firebase/firestore';

export type LogAction = 'CREATE' | 'TRANSFER' | 'CHECKED' | 'DELETE' | 'UPDATE' | 'SECURITY_ALERT';

export interface LogEvent {
  id?: string;
  deviceId?: string;
  tsadiNumber: string;
  action: LogAction;
  user: string;
  details: string;
  platoon?: string;
  involvedPlatoons?: string[];
  timestamp: Timestamp;
  dohId?: string;
}
