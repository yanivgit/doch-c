import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { fetchMetadata, learnMetadata, BattalionMetadata } from '../firebase/api';
import { EQUIPMENT_TYPES, PLUGOT_WITH_UNASSIGNED } from '../constants/data';
import { getLocationsForPlatoon as getStaticLocationsForPlatoon } from '../utils/locations';

export type UserRole = 'Kashpal' | 'Kashrag';

interface AppContextState {
  userRole: UserRole | null;
  selectedDohId: string | null;
  selectedDohName: string | null;
  selectedPlatoon: string | null;
  isLoading: boolean;
  login: (role: UserRole) => void;
  selectDoh: (dohId: string, dohName: string) => Promise<void>;
  selectPlatoon: (platoon: string) => Promise<void>;
  clearDoh: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Dynamic Learning
  getAllEquipmentTypes: () => string[];
  getAllPlatoons: () => string[];
  getLocationsForPlatoon: (platoon: string) => string[];
  learnNewOption: (category: 'equipment' | 'platoon' | 'location', value: string, platoonContext?: string) => void;
}

const AppContext = createContext<AppContextState | undefined>(undefined);

const ROLE_KEY = '@user_role';
const DOH_KEY = '@selected_doh_id';
const DOH_NAME_KEY = '@selected_doh_name';
const PLATOON_KEY = '@selected_platoon';

const ALL_KEYS = [ROLE_KEY, DOH_KEY, DOH_NAME_KEY, PLATOON_KEY] as const;

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [selectedDohId, setSelectedDohId] = useState<string | null>(null);
  const [selectedDohName, setSelectedDohName] = useState<string | null>(null);
  const [selectedPlatoon, setSelectedPlatoon] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic Metadata State
  const [learnedMetadata, setLearnedMetadata] = useState<BattalionMetadata>({
    equipmentTypes: [],
    platoons: [],
    locations: {}
  });

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        // Fetch async storage and metadata in parallel
        const [results, metadata] = await Promise.all([
          AsyncStorage.multiGet([...ALL_KEYS]),
          fetchMetadata()
        ]);
        
        if (metadata) {
          setLearnedMetadata(metadata);
        }

        const map = Object.fromEntries(results);

        if (map[ROLE_KEY]) setUserRole(map[ROLE_KEY] as UserRole);
        if (map[DOH_KEY]) setSelectedDohId(map[DOH_KEY]);
        if (map[DOH_NAME_KEY]) setSelectedDohName(map[DOH_NAME_KEY]);
        if (map[PLATOON_KEY]) setSelectedPlatoon(map[PLATOON_KEY]);
      } catch (error) {
        console.error('Error reading initial state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialState();
  }, []);

  const login = useCallback((role: UserRole) => {
    setUserRole(role);
  }, []);

  const selectDoh = useCallback(async (dohId: string, dohName: string) => {
    try {
      const pairs: [string, string][] = [
        [DOH_KEY, dohId],
        [DOH_NAME_KEY, dohName],
      ];
      if (userRole) pairs.push([ROLE_KEY, userRole]);
      await AsyncStorage.multiSet(pairs);
      setSelectedDohId(dohId);
      setSelectedDohName(dohName);
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }, [userRole]);

  const selectPlatoon = useCallback(async (platoon: string) => {
    try {
      await AsyncStorage.setItem(PLATOON_KEY, platoon);
      setSelectedPlatoon(platoon);
    } catch (error) {
      console.error('Error saving platoon state:', error);
    }
  }, []);

  const clearDoh = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([DOH_KEY, DOH_NAME_KEY]);
      setSelectedDohId(null);
      setSelectedDohName(null);
    } catch (error) {
      console.error('Error clearing doh state:', error);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([...ALL_KEYS]);
      setUserRole(null);
      setSelectedDohId(null);
      setSelectedDohName(null);
      setSelectedPlatoon(null);
      
      if (auth?.currentUser) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, []);

  // --- Dynamic Learning Methods ---
  
  const getAllEquipmentTypes = useCallback(() => {
    const combined = [...EQUIPMENT_TYPES, ...learnedMetadata.equipmentTypes];
    return Array.from(new Set(combined)); // Deduplicate
  }, [learnedMetadata.equipmentTypes]);

  const getAllPlatoons = useCallback(() => {
    const combined = [...PLUGOT_WITH_UNASSIGNED, ...learnedMetadata.platoons];
    return Array.from(new Set(combined));
  }, [learnedMetadata.platoons]);

  const getLocationsForPlatoon = useCallback((platoon: string) => {
    const staticLocations = getStaticLocationsForPlatoon(platoon);
    const learnedForPlatoon = learnedMetadata.locations[platoon] || [];
    const learnedDefault = learnedMetadata.locations['__default'] || [];
    
    const combined = [...staticLocations, ...learnedForPlatoon, ...learnedDefault];
    return Array.from(new Set(combined));
  }, [learnedMetadata.locations]);

  const learnNewOption = useCallback((category: 'equipment' | 'platoon' | 'location', value: string, platoonContext?: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    let isNew = false;

    setLearnedMetadata(prev => {
      const newState = { ...prev };
      
      if (category === 'equipment') {
        const allTypes = [...EQUIPMENT_TYPES, ...newState.equipmentTypes];
        if (!allTypes.includes(trimmedValue)) {
          newState.equipmentTypes = [...newState.equipmentTypes, trimmedValue];
          isNew = true;
        }
      } else if (category === 'platoon') {
        const allPlatoons = [...PLUGOT_WITH_UNASSIGNED, ...newState.platoons];
        if (!allPlatoons.includes(trimmedValue)) {
          newState.platoons = [...newState.platoons, trimmedValue];
          isNew = true;
        }
      } else if (category === 'location') {
        const key = platoonContext || '__default';
        const currentLocs = newState.locations[key] || [];
        const staticLocs = platoonContext ? getStaticLocationsForPlatoon(platoonContext) : [];
        
        if (!currentLocs.includes(trimmedValue) && !staticLocs.includes(trimmedValue)) {
          newState.locations = {
            ...newState.locations,
            [key]: [...currentLocs, trimmedValue]
          };
          isNew = true;
        }
      }

      return newState;
    });

    if (isNew) {
      // Fire and forget to persistent storage
      learnMetadata(category, trimmedValue, platoonContext).catch(console.error);
    }
  }, []);

  const value = useMemo<AppContextState>(() => ({
    userRole,
    selectedDohId,
    selectedDohName,
    selectedPlatoon,
    isLoading,
    login,
    selectDoh,
    selectPlatoon,
    clearDoh,
    logout,
    getAllEquipmentTypes,
    getAllPlatoons,
    getLocationsForPlatoon,
    learnNewOption
  }), [userRole, selectedDohId, selectedDohName, selectedPlatoon, isLoading, login, selectDoh, selectPlatoon, clearDoh, logout, getAllEquipmentTypes, getAllPlatoons, getLocationsForPlatoon, learnNewOption]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
