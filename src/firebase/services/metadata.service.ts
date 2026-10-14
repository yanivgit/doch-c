import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../config';
import { BattalionMetadata, MetadataCategory } from '../../types';

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
