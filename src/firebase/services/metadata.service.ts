import { 
  doc, 
  getDoc, 
  setDoc, 
  arrayUnion,
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../config';
import { BattalionMetadata, MetadataCategory } from '../../types';
import { sanitizeInput } from '../../utils/security';

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

export const subscribeToMetadata = (
  onUpdate: (metadata: BattalionMetadata) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const docRef = doc(db, 'battalion_settings', 'metadata');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as BattalionMetadata);
      }
    },
    (error) => {
      console.error("Error in metadata snapshot listener:", error);
      onError?.(error);
    }
  );
};

export const learnMetadata = async (
  category: MetadataCategory,
  value: string,
  platoonContext?: string
) => {
  try {
    const cleanValue = sanitizeInput(value, 60);
    if (!cleanValue) return;

    const docRef = doc(db, 'battalion_settings', 'metadata');

    if (category === 'equipment') {
      await setDoc(docRef, {
        equipmentTypes: arrayUnion(cleanValue)
      }, { merge: true });
    } else if (category === 'platoon') {
      await setDoc(docRef, {
        platoons: arrayUnion(cleanValue)
      }, { merge: true });
    } else if (category === 'location') {
      const cleanContext = platoonContext ? sanitizeInput(platoonContext, 50) : '__default';
      const key = cleanContext || '__default';
      await setDoc(docRef, {
        locations: {
          [key]: arrayUnion(cleanValue)
        }
      }, { merge: true });
    }
  } catch (error) {
    console.error(`Error learning new metadata for ${category}: `, error);
  }
};
