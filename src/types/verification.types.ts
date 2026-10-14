import { Timestamp } from 'firebase/firestore';

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
    };
  };
  verifiedDevices: {
    [deviceId: string]: {
      verifiedAt: Timestamp;
      verifiedBy: string;
      platoon?: string;
    };
  };
  archivedAt?: Timestamp;
  autoArchivedIncomplete?: boolean;
  completionNotes?: string;
}

export interface MissingDevice {
  id: string;
  type: string;
  tsadiNumber: string;
  assignment: string;
  location?: string;
}

export interface VerificationHistory {
  id?: string;
  dohId: string;
  date: string;
  overallProgress: string;
  platoonBreakdown: {
    [platoon: string]: string; // e.g. "8/10 (80%)"
  };
  status: 'בוצע' | 'לא הושלם';
  missingDevices?: MissingDevice[];
  archivedAt: Timestamp;
  autoArchivedIncomplete?: boolean;
  completionNotes?: string;
}
