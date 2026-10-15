import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion 
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

export const learnMetadata = async (
  category: MetadataCategory,
  value: string,
  platoonContext?: string
) => {
  try {
    const cleanValue = sanitizeInput(value, 60);
    if (!cleanValue) return;

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
        equipmentTypes: arrayUnion(cleanValue)
      });
    } else if (category === 'platoon') {
      await updateDoc(docRef, {
        platoons: arrayUnion(cleanValue)
      });
    } else if (category === 'location') {
      const cleanContext = platoonContext ? sanitizeInput(platoonContext, 50) : '__default';
      const key = cleanContext || '__default';
      await updateDoc(docRef, {
        [`locations.${key}`]: arrayUnion(cleanValue)
      });
    }
  } catch (error) {
    console.error(`Error learning new metadata for ${category}: `, error);
  }
};
