import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  TextInput,
  Animated,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { 
  Device, 
  VerificationSession, 
  verifyDevice, 
  unverifyDevice,
  startKashpalSession, 
  endKashpalSession, 
  getDailyDocId, 
  getDevicesByPlatoonAndDohId,
  subscribeToDevicesByPlatoonAndDohId,
  markDeviceAsFixed
} from '../../../firebase/api';
import { db } from '../../../firebase/config';
import { onSnapshot, doc, collection, query, where } from 'firebase/firestore';
import SearchableDropdown from '../../../components/SearchableDropdown';
import EditLocationModal from '../../../components/EditLocationModal';
import DailySummaryModal from '../../../components/DailySummaryModal';
import ReportFaultModal from '../../../components/ReportFaultModal';
import Snackbar from '../../../components/Snackbar';
import OfflineBanner from '../../../components/OfflineBanner';
import { PLUGOT } from '../../../constants/data';
import { theme } from '../../../theme/theme';
import { compareEquipmentTypes, getEquipmentTypePriority, getEquipmentCategoryGroup, isShakedKitDevice } from '../../../utils';

export default function KashpalReportScreen() {
  const router = useRouter();
  const { 
    userRole, 
    selectedDohId, 
    selectedPlatoon, 
    selectPlatoon, 
    logout, 
    getKashpalPlatoons, 
    learnNewOption 
  } = useApp();
  
  useEffect(() => {
    if (userRole === null) {
      router.replace('/');
    }
  }, [userRole, router]);
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [verifiedDevicesMap, setVerifiedDevicesMap] = useState<Record<string, { verifiedAt: any; verifiedBy: string }>>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Modals state
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);
  const [faultModalDevice, setFaultModalDevice] = useState<Device | null>(null);
  const [isFaultModalVisible, setIsFaultModalVisible] = useState(false);
  
  // Tactical Mode & Filter states
  // Mode A: 'report' ("ביקורת שטח") - Fast physical verification
  // Mode B: 'inventory' ("מצאי וצק״ח") - Full equipment details, transfers, locations, faults
  const [activeTab, setActiveTab] = useState<'report' | 'inventory'>('report');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('הכל');

  // Pulse animation value for active session beacon
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Manual fallback refresh
  const fetchDevices = useCallback(async () => {
    if (!selectedPlatoon || !selectedDohId) return;
    try {
      const platoonDevices = await getDevicesByPlatoonAndDohId(selectedPlatoon, selectedDohId);
      setDevices(platoonDevices);
    } catch (error) {
      console.error("Error fetching devices manually:", error);
    }
  }, [selectedPlatoon, selectedDohId]);

  const handleMarkFixed = useCallback(async (device: Device) => {
    if (!device.id) return;
    try {
      const currentUser = selectedPlatoon ? `קשפ"ל_${selectedPlatoon}` : 'קשפ"ל';
      await markDeviceAsFixed(device.id, currentUser);
      if (Platform.OS === 'web') {
        window.alert(`המכשיר צ' ${device.tsadiNumber} סומן כתוקן וחזר לכשירות.`);
      } else {
        Alert.alert('עודכן בהצלחה', `המכשיר צ' ${device.tsadiNumber} סומן כתוקן וחזר לכשירות.`);
      }
      fetchDevices();
    } catch (error) {
      console.error('Error marking device as fixed:', error);
      Alert.alert('שגיאה', 'לא ניתן לעדכן את סטטוס המכשיר');
    }
  }, [selectedPlatoon, fetchDevices]);

  const confirmMarkFixed = useCallback((device: Device) => {
    const message = `האם לסמן את המכשיר (${device.type}) צ' ${device.tsadiNumber} כתוקן ולהחזירו לכשירות?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        handleMarkFixed(device);
      }
      return;
    }
    Alert.alert(
      'סימון מכשיר כתוקן',
      message,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'סמן כתוקן', onPress: () => handleMarkFixed(device) }
      ]
    );
  }, [handleMarkFixed]);

  // Real-time synchronization for platoon devices
  useEffect(() => {
    if (!selectedPlatoon || !selectedDohId) {
      setDevices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToDevicesByPlatoonAndDohId(
      selectedPlatoon,
      selectedDohId,
      (liveDevices) => {
        setDevices(liveDevices);
        setLoading(false);
      },
      (error) => {
        console.error("Error in Kashpal live devices subscription:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedPlatoon, selectedDohId]);

  // Real-time synchronization with active session
  useEffect(() => {
    if (!selectedDohId) return;
    const docId = getDailyDocId(selectedDohId);
    const docRef = doc(db, 'verificationSessions', docId);

    const unsubscribe = onSnapshot(docRef, (snap) => {
      try {
        if (!snap.exists()) {
          setActiveSession(null);
          return;
        }
        const sessionData = { id: snap.id, ...snap.data() } as VerificationSession;
        setActiveSession(sessionData);
      } catch (error) {
        console.error("Error processing snapshot:", error);
      }
    });

    return () => unsubscribe();
  }, [selectedDohId]);

  // Real-time synchronization for verified devices subcollection
  useEffect(() => {
    if (!activeSession?.id || !selectedPlatoon) {
      setVerifiedDevicesMap({});
      return;
    }

    const colRef = collection(db, 'verificationSessions', activeSession.id, 'verifiedDevices');
    const q = query(colRef, where('platoon', '==', selectedPlatoon));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const verifiedMap: Record<string, { verifiedAt: any; verifiedBy: string; platoon?: string }> = {};
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          verifiedMap[docSnap.id] = {
            verifiedAt: data.verifiedAt,
            verifiedBy: data.verifiedBy || '',
            platoon: data.platoon
          };
        });
        setVerifiedDevicesMap(verifiedMap);
      },
      (error) => {
        console.error("Error subscribing to verified devices in Kashpal:", error);
      }
    );

    return () => unsubscribe();
  }, [activeSession?.id, selectedPlatoon]);

  // Status checks for current platoon in today's daily session
  const isSessionArchived = useMemo(() => {
    return activeSession?.globalStatus === 'archived';
  }, [activeSession]);

  const isMyPlatoonCompleted = useMemo(() => {
    return (
      isSessionArchived ||
      activeSession?.platoons?.[selectedPlatoon || '']?.status === 'completed'
    );
  }, [activeSession, selectedPlatoon, isSessionArchived]);

  const isMyPlatoonActive = useMemo(() => {
    if (isMyPlatoonCompleted || isSessionArchived) return false;
    return (
      activeSession?.platoons?.[selectedPlatoon || '']?.status === 'active' || 
      activeSession?.globalStatus === 'active'
    );
  }, [activeSession, selectedPlatoon, isMyPlatoonCompleted, isSessionArchived]);

  const canVerify = isMyPlatoonActive && !isMyPlatoonCompleted && !isSessionArchived;

  // Pulse animation for active session beacon
  useEffect(() => {
    if (!canVerify) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [canVerify, pulseAnim]);

  // Formatted date string [DD.MM]
  const formattedDate = useMemo(() => {
    let dateObj = new Date();
    if (activeSession?.createdAt?.toDate) {
      dateObj = activeSession.createdAt.toDate();
    }
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  }, [activeSession]);

  // Helper for category label & icon
  const getDeviceCategory = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('קשר') || t.includes('710') || t.includes('סלולר') || t.includes('אולר') || t.includes('טל') || t.includes('בינה')) {
      return { tag: 'קשר', iconName: 'radio', isCommunity: false, isMaterial: true };
    }
    if (t.includes('אופטיקה') || t.includes('ראי') || t.includes('נר') || t.includes('מג"ס') || t.includes('מג״ס') || t.includes('אמר')) {
      return { tag: 'אופטיקה', iconName: 'military-tech', isCommunity: false, isMaterial: true };
    }
    if (t.includes('מדיה')) {
      return { tag: 'מדיה', iconName: 'memory', isCommunity: false, isMaterial: true };
    }
    if (t.includes('רפואה') || t.includes('עזרה') || t.includes('חובש') || t.includes('ערכת')) {
      return { tag: 'רפואה', iconName: 'medical-bag', isCommunity: true, isMaterial: false };
    }
    if (t.includes('ניווט') || t.includes('לוויין') || t.includes('טאבלט') || t.includes('סיאף') || t.includes('מחשב')) {
      return { tag: 'ניווט', iconName: 'satellite-variant', isCommunity: true, isMaterial: false };
    }
    return { tag: 'ציוד', iconName: 'devices', isCommunity: false, isMaterial: true };
  };

  // Extract unique locations from current platoon
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    devices.forEach(d => {
      const loc = d.location?.trim();
      if (loc) locSet.add(loc);
    });
    return Array.from(locSet).sort((a, b) => a.localeCompare(b));
  }, [devices]);

  // Reset search and location filters when switching platoons
  useEffect(() => {
    setSearchQuery('');
    setLocationFilter('הכל');
  }, [selectedPlatoon]);

  // Ensure location filter resets to 'הכל' if current location filter is no longer in platoon locations
  useEffect(() => {
    if (locationFilter !== 'הכל' && !uniqueLocations.includes(locationFilter)) {
      setLocationFilter('הכל');
    }
  }, [uniqueLocations, locationFilter]);

  // Filter & sort logic
  const filteredAndSortedDevices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    let filtered = devices.filter(d => {
      // If this device is a media and already linked to a host device,
      // it should NOT appear as its own standalone card in Kashpal!
      // It is listed and verified directly under its host (Magen Michlol / Elad Yarok / Shen Bina).
      const isMedia = (d.type || '').toLowerCase().includes('מדיה') || (d.type || '').toLowerCase().includes('נתיק');
      const isLinkedMedia = isMedia && Boolean(d.linkedDeviceId || d.linkedTsadi);
      if (isLinkedMedia) {
        return false;
      }

      // If this device is a member of an active Shaked Kit (has parentKitId),
      // it should NOT appear as its own standalone card in Kashpal!
      // It is rendered inside the Shaked Kit card!
      const hasActiveParentKit = Boolean(
        d.parentKitId &&
        d.parentKitId !== d.id &&
        devices.some(k => k.id === d.parentKitId && isShakedKitDevice(k))
      );
      if (hasActiveParentKit) {
        return false;
      }

      if (locationFilter !== 'הכל') {
        if (d.location?.trim() !== locationFilter) return false;
      }
      if (!query) return true;
      const tsadiMatch = d.tsadiNumber?.toLowerCase().includes(query);
      const locMatch = d.location?.toLowerCase().includes(query);
      const typeMatch = d.type?.toLowerCase().includes(query);
      const linkedMatch = (d.linkedTsadi && d.linkedTsadi.toLowerCase().includes(query)) || (d.linkedType && d.linkedType.toLowerCase().includes(query));
      const kitMatch = Boolean(
        isShakedKitDevice(d) && (
          (d.kitName && d.kitName.toLowerCase().includes(query)) ||
          (d.tel100Tsadi && d.tel100Tsadi.toLowerCase().includes(query)) ||
          (d.mabanTsadi && d.mabanTsadi.toLowerCase().includes(query)) ||
          (d.tabletTsadi && d.tabletTsadi.toLowerCase().includes(query))
        )
      );
      return tsadiMatch || locMatch || typeMatch || linkedMatch || kitMatch;
    });

    return filtered.sort((a, b) => {
      if (activeTab === 'report') {
        const isVerifiedA = !!(a.id && (verifiedDevicesMap[a.id] || activeSession?.verifiedDevices?.[a.id]));
        const isVerifiedB = !!(b.id && (verifiedDevicesMap[b.id] || activeSession?.verifiedDevices?.[b.id]));
        if (isVerifiedA !== isVerifiedB) {
          return isVerifiedA ? 1 : -1;
        }
      }

      // Sort by Equipment Type (Tactical Priority: סלולר -> שקד -> אולרים -> 710 -> מגני מכלול ומדיה -> נרות לילה...)
      const pA = getEquipmentTypePriority(a.type, a);
      const pB = getEquipmentTypePriority(b.type, b);
      if (pA !== pB) return pA - pB;
      const typeDiff = compareEquipmentTypes(a.type, b.type);
      if (typeDiff !== 0) return typeDiff;

      const locA = a.location?.trim() || '';
      const locB = b.location?.trim() || '';
      if (locA && !locB) return -1;
      if (!locA && locB) return 1;
      const locDiff = locA.localeCompare(locB, 'he');
      if (locDiff !== 0) return locDiff;

      return (a.tsadiNumber || '').localeCompare(b.tsadiNumber || '', undefined, { numeric: true });
    });
  }, [devices, searchQuery, locationFilter, activeSession, activeTab, verifiedDevicesMap]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) {
        logout();
      }
      return;
    }
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'התנתק', style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleStartSession = async () => {
    if (!selectedDohId || !selectedPlatoon) return;
    try {
      await startKashpalSession(selectedDohId, selectedPlatoon);
    } catch (e: any) {
      if (e.message === 'ARCHIVED') {
        Alert.alert('שגיאה', 'הדו"ח היומי כבר ננעל והועבר להיסטוריה על ידי הקשר"ג.');
      } else {
        Alert.alert('שגיאה', 'לא ניתן ליצור דו"ח חדש');
      }
    }
  };

  const handleEndSession = async () => {
    if (!selectedDohId || !selectedPlatoon) return;

    const currentVerifiedCount = devices.filter(d => d.id && (verifiedDevicesMap[d.id] || activeSession?.verifiedDevices?.[d.id])).length;
    const missingCount = devices.length - currentVerifiedCount;

    const performEnd = async () => {
      try {
        await endKashpalSession(selectedDohId, selectedPlatoon);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (missingCount > 0) {
          Alert.alert('הדו"ח ננעל עם חוסרים', `הדו"ח היומי לפלוגה ${selectedPlatoon} ננעל וסומן כחסר (${missingCount} פריטים שלא אומתו).`);
        } else {
          Alert.alert('כל הכבוד!', 'הדו"ח היומי הסתיים ונשלח לקשר"ג בהצלחה!');
        }
      } catch (error) {
        console.error("Error ending session:", error);
        Alert.alert('שגיאה', 'לא ניתן לסיים דו"ח.');
      }
    };

    if (missingCount > 0) {
      const confirmWarning = `⚠️ שים לב: אימתת ${currentVerifiedCount} מתוך ${devices.length} פריטים בפלוגה ${selectedPlatoon}.\n\nנותרו ${missingCount} פריטים שלא אומתו!\n\nנעילת הדו"ח תסמן לקשר"ג שסיימת עם חוסרים.\nהאם לנעול בכל זאת?`;
      if (Platform.OS === 'web') {
        if (window.confirm(confirmWarning)) {
          await performEnd();
        }
        return;
      }

      Alert.alert(
        '⚠️ אזהרה: נותרו פריטים שלא נבדקו!',
        `אימתת ${currentVerifiedCount} מתוך ${devices.length} פריטים בפלוגה ${selectedPlatoon}.\nנותרו ${missingCount} פריטים שלא אומתו.\n\nנעילת הדו"ח תסמן לקשר"ג שסיימת עם חוסרים.\nהאם לנעול בכל זאת?`,
        [
          { text: 'המשך ספירה', style: 'cancel' },
          { text: 'נעל דו"ח עם חוסרים', style: 'destructive', onPress: performEnd }
        ]
      );
    } else {
      const confirmSuccess = `כל ${devices.length} הפריטים של פלוגה ${selectedPlatoon} אומתו בהצלחה!\n\nהאם לנעול ולשלוח את הדו"ח לקשר"ג?`;
      if (Platform.OS === 'web') {
        if (window.confirm(confirmSuccess)) {
          await performEnd();
        }
        return;
      }

      Alert.alert(
        'סיום דו"ח פלוגתי',
        `כל ${devices.length} הפריטים של פלוגה ${selectedPlatoon} אומתו בהצלחה!\nהאם לנעול ולשלוח לקשר"ג?`,
        [
          { text: 'ביטול', style: 'cancel' },
          { text: 'נעל ושלח דיווח', style: 'default', onPress: performEnd }
        ]
      );
    }
  };

  const handleVerifyDevice = async (deviceId: string) => {
    if (!activeSession || !activeSession.id || !selectedPlatoon) {
      setSnackbarMessage('יש לפתוח סבב דו"ח כדי לאמת ציוד');
      setSnackbarVisible(true);
      return;
    }
    if (!canVerify) {
      setSnackbarMessage('הסבב הנוכחי נעול או הושלם');
      setSnackbarVisible(true);
      return;
    }
    try {
      const isAlreadyVerified = !!(verifiedDevicesMap[deviceId] || activeSession?.verifiedDevices?.[deviceId]);
      const targetDevice = devices.find(d => d.id === deviceId);

      if (isAlreadyVerified) {
        await unverifyDevice(activeSession.id, deviceId);
        // If device has linked media/host, also unverify it together
        if (targetDevice?.linkedDeviceId) {
          const linkedId = targetDevice.linkedDeviceId;
          const isLinkedVerified = !!(verifiedDevicesMap[linkedId] || activeSession?.verifiedDevices?.[linkedId]);
          if (isLinkedVerified) {
            await unverifyDevice(activeSession.id, linkedId);
          }
        }
        // If device is a Shaked Kit, also unverify all member devices together
        if (targetDevice?.isKit) {
          const memberIds = [targetDevice.tel100DeviceId, targetDevice.mabanDeviceId, targetDevice.tabletDeviceId].filter(Boolean) as string[];
          for (const mId of memberIds) {
            const isMemberVerified = !!(verifiedDevicesMap[mId] || activeSession?.verifiedDevices?.[mId]);
            if (isMemberVerified) {
              await unverifyDevice(activeSession.id, mId);
            }
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSnackbarMessage('אימות הפריט בוטל');
        setSnackbarVisible(true);
      } else {
        await verifyDevice(activeSession.id, deviceId, `קשפ"ל_${selectedPlatoon}`, selectedPlatoon);
        // If device has linked media/host, also verify it together so both Tsadis are accounted for!
        if (targetDevice?.linkedDeviceId) {
          const linkedId = targetDevice.linkedDeviceId;
          const isLinkedVerified = !!(verifiedDevicesMap[linkedId] || activeSession?.verifiedDevices?.[linkedId]);
          if (!isLinkedVerified) {
            await verifyDevice(activeSession.id, linkedId, `קשפ"ל_${selectedPlatoon}`, selectedPlatoon);
          }
        }
        // If device is a Shaked Kit, also verify all member devices together
        if (targetDevice?.isKit) {
          const memberIds = [targetDevice.tel100DeviceId, targetDevice.mabanDeviceId, targetDevice.tabletDeviceId].filter(Boolean) as string[];
          for (const mId of memberIds) {
            const isMemberVerified = !!(verifiedDevicesMap[mId] || activeSession?.verifiedDevices?.[mId]);
            if (!isMemberVerified) {
              await verifyDevice(activeSession.id, mId, `קשפ"ל_${selectedPlatoon}`, selectedPlatoon);
            }
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לעדכן את המכשיר. נסה שוב.');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setLocationFilter('הכל');
  };

  const verifiedCount = devices.filter(d => d.id && (verifiedDevicesMap[d.id] || activeSession?.verifiedDevices?.[d.id])).length;
  const progressPercent = devices.length > 0 ? (verifiedCount / devices.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <OfflineBanner />
      
      {/* 1. Tactical Command Header */}
      <View style={styles.commandHeader}>
        <View style={styles.headerRightBlock}>
          <TouchableOpacity 
            style={styles.unitBadge}
            onPress={() => selectPlatoon('')}
            activeOpacity={selectedPlatoon ? 0.7 : 1}
            disabled={!selectedPlatoon}
          >
            <MaterialCommunityIcons name="shield-check" size={14} color="#15803D" />
            <Text style={styles.unitBadgeText}>{selectedPlatoon || 'בחר פלוגה'}</Text>
            {selectedPlatoon ? (
              <Feather name="chevron-down" size={12} color="#15803D" style={{ marginLeft: 2 }} />
            ) : null}
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>ביקורת כשירות קשפ״ל</Text>
          </View>
        </View>

        <View style={styles.headerLeftBlock}>
          {selectedPlatoon ? (
            <TouchableOpacity 
              style={styles.headerActionBtn} 
              onPress={() => setIsTimelineVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="clipboard" size={15} color="#0F172A" />
              <Text style={styles.headerActionBtnText}>יומן אירועים</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity 
            style={styles.logoutBtn} 
            onPress={handleLogout}
            activeOpacity={0.8}
            accessibilityLabel="התנתק"
          >
            <Feather name="log-out" size={17} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {selectedPlatoon ? (
        <View style={{ flex: 1 }}>
          <FlatList
            style={styles.mainScroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            data={filteredAndSortedDevices}
            keyExtractor={(device) => device.id || device.tsadiNumber}
            ListHeaderComponent={
              <View>
                {/* 2. Operational Status Console */}
                {canVerify ? (
                  <View style={styles.activeSessionBanner}>
                    <View style={styles.bannerTopRow}>
                      <View style={styles.beaconIndicator}>
                        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
                        <Text style={styles.bannerActiveText}>יש דו"ח פעיל!</Text>
                      </View>
                      <View style={styles.progressStats}>
                        <Text style={styles.progressCountText}>
                          {verifiedCount} / {devices.length}
                        </Text>
                        <Text style={styles.progressPercentText}>
                          ({Math.round(progressPercent)}%)
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar Track */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>

                    {/* Submit Report Action Button */}
                    <TouchableOpacity 
                      style={styles.submitReportBtn}
                      onPress={handleEndSession}
                      activeOpacity={0.88}
                    >
                      <MaterialCommunityIcons name="send-check" size={18} color="#FFFFFF" />
                      <Text style={styles.submitReportBtnText}>
                        {verifiedCount === devices.length && devices.length > 0 
                          ? 'סיום ונעילת דו״ח (100% אומת)' 
                          : 'נעל ושלח דו״ח לקשר״ג'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isMyPlatoonCompleted || isSessionArchived ? (
                  <View style={styles.completedBanner}>
                    <View style={styles.completedHeader}>
                      <MaterialCommunityIcons name="check-decagram" size={24} color="#15803D" />
                      <Text style={styles.completedTitle}>
                        {isSessionArchived
                          ? 'הדו״ח היומי הושלם במלואו וננעל בהיסטוריה!'
                          : 'הדו״ח היומי הושלם ומסונכרן מול הקשר״ג'}
                      </Text>
                    </View>
                    <Text style={styles.completedSubtitle}>
                      {isSessionArchived
                        ? `כלל הפריטים בגדוד אומתו וסונכרנו בהצלחה (${verifiedCount}/${devices.length}). הדו"ח נשמר בארכיון הגדודי כהושלם.`
                        : `${verifiedCount} מתוך ${devices.length} פריטים נבדקו ואומתו. רשימת הציוד פתוחה לעיון ועדכון מיקומים.`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.idleSessionBanner}>
                    <View style={styles.idleTextGroup}>
                      <Text style={styles.idleTitle}>אין דו״ח פעיל כרגע</Text>
                      <Text style={styles.idleSub}>הפעל סבב יומי כדי לאמת את ציוד הפלוגה בשטח</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.startSessionBtn}
                      onPress={handleStartSession}
                      activeOpacity={0.85}
                    >
                      <Feather name="play" size={15} color="#FFFFFF" />
                      <Text style={styles.startSessionBtnText}>הפעל דו״ח</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. Segmented Mode Switcher */}
                <View style={styles.modeSwitcher}>
                  <TouchableOpacity 
                    style={[styles.modeTab, activeTab === 'report' && styles.modeTabActive]}
                    onPress={() => setActiveTab('report')}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons 
                      name="clipboard-check-outline" 
                      size={18} 
                      color={activeTab === 'report' ? '#15803D' : '#64748B'} 
                    />
                    <Text style={[styles.modeTabText, activeTab === 'report' && styles.modeTabTextActive]}>
                      ביקורת שטח ({devices.length - verifiedCount} נותרו)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modeTab, activeTab === 'inventory' && styles.modeTabActive]}
                    onPress={() => setActiveTab('inventory')}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons 
                      name="format-list-bulleted" 
                      size={18} 
                      color={activeTab === 'inventory' ? '#15803D' : '#64748B'} 
                    />
                    <Text style={[styles.modeTabText, activeTab === 'inventory' && styles.modeTabTextActive]}>
                      מצאי וצק״ח ({devices.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 4. Search & Filter Bar */}
                <View style={styles.searchSection}>
                  <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#64748B" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="חיפוש לפי צ׳, סוג או מיקום..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      textAlign="right"
                      placeholderTextColor="#94A3B8"
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                        <Feather name="x" size={16} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Horizontal Location Chips */}
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.locationChipsScroll}
                  >
                    <TouchableOpacity
                      style={[styles.locChip, locationFilter === 'הכל' && styles.locChipActive]}
                      onPress={() => setLocationFilter('הכל')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.locChipText, locationFilter === 'הכל' && styles.locChipTextActive]}>
                        כל המיקומים
                      </Text>
                    </TouchableOpacity>

                    {uniqueLocations.map((loc) => {
                      const isSelected = locationFilter === loc;
                      return (
                        <TouchableOpacity
                          key={loc}
                          style={[styles.locChip, isSelected && styles.locChipActive]}
                          onPress={() => setLocationFilter(loc)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.locChipText, isSelected && styles.locChipTextActive]}>
                            {loc}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Active Filter Reset Info */}
                {(searchQuery.trim().length > 0 || locationFilter !== 'הכל') && (
                  <View style={styles.filterFeedbackRow}>
                    <Text style={styles.filterFeedbackText}>
                      נמצאו {filteredAndSortedDevices.length} פריטים
                    </Text>
                    <TouchableOpacity onPress={resetFilters} style={styles.resetFilterLink}>
                      <Text style={styles.resetFilterLinkText}>איפוס סינונים</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="inbox" size={40} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyTitle}>לא נמצא ציוד מתאים</Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim() || locationFilter !== 'הכל'
                    ? 'נסה לשנות את החיפוש או הסינון'
                    : 'לא רשום ציוד עבור פלוגה זו'}
                </Text>
                {(searchQuery.trim() || locationFilter !== 'הכל') && (
                  <TouchableOpacity onPress={resetFilters} style={styles.emptyResetBtn}>
                    <Text style={styles.emptyResetBtnText}>איפוס חיפוש</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item: device, index }) => {
              const isVerified = !!(device.id && (verifiedDevicesMap[device.id] || activeSession?.verifiedDevices?.[device.id]));
              const cat = getDeviceCategory(device.type);
              const fault = device.faultStatus;

              const currentCat = getEquipmentCategoryGroup(device);
              const prevDevice = index > 0 ? filteredAndSortedDevices[index - 1] : undefined;
              const prevCat = prevDevice ? getEquipmentCategoryGroup(prevDevice) : undefined;
              const showCategoryDivider = activeTab === 'inventory' && (!prevCat || prevCat.id !== currentCat.id);

              const categoryDivider = showCategoryDivider ? (
                <View style={styles.categoryDividerContainer}>
                  <View style={styles.categoryDividerLine} />
                  <View style={styles.categoryBadge}>
                    <MaterialCommunityIcons name={currentCat.iconName as any} size={13} color="#0369A1" />
                    <Text style={styles.categoryBadgeText}>{currentCat.title}</Text>
                  </View>
                  <View style={styles.categoryDividerLine} />
                </View>
              ) : null;

              const isKit = isShakedKitDevice(device);
              const tel100Tsadi = device.tel100Tsadi;
              const mabanTsadi = device.mabanTsadi;
              const tabletTsadi = device.tabletTsadi;

              const tel100Dev = tel100Tsadi ? devices.find(d => d.id === device.tel100DeviceId || (d.tsadiNumber === tel100Tsadi && (d.type || '').includes('טל 100'))) : null;
              const mabanDev = mabanTsadi ? devices.find(d => d.id === device.mabanDeviceId || (d.tsadiNumber === mabanTsadi && (d.type || '').includes('מבן'))) : null;
              const tabletDev = tabletTsadi ? devices.find(d => d.id === device.tabletDeviceId || (d.tsadiNumber === tabletTsadi && (d.type || '').includes('טאבלט'))) : null;

              const hasAnyFault = tel100Dev?.faultStatus || mabanDev?.faultStatus || tabletDev?.faultStatus;

              // MODE A: Fast Verification Checklist Card
              if (activeTab === 'report') {
                if (isKit) {
                  return (
                    <View style={[
                      styles.card,
                      styles.shakedKitCard,
                      isVerified && styles.cardVerified,
                      hasAnyFault === 'inspection' && styles.cardInspection,
                      hasAnyFault === 'replacement' && styles.cardReplacement,
                    ]}>
                      <TouchableOpacity 
                        style={styles.cardInteractiveRow}
                        activeOpacity={0.85}
                        onPress={() => device.id && handleVerifyDevice(device.id)}
                      >
                        <View style={styles.cardInfoGroup}>
                          <View style={[
                            styles.catIconContainer,
                            isVerified ? styles.catIconVerified : styles.catIconPending,
                            { backgroundColor: isVerified ? '#DCFCE7' : '#E0F2FE', borderColor: isVerified ? '#BBF7D0' : '#BAE6FD' }
                          ]}>
                            <MaterialCommunityIcons 
                              name="toolbox" 
                              size={22} 
                              color={isVerified ? '#15803D' : '#0284C7'} 
                            />
                          </View>

                          <View style={styles.cardDetails}>
                            <View style={styles.cardTitleRow}>
                              <View style={styles.kitBadge}>
                                <Text style={styles.kitBadgeText}>ערכת שקד</Text>
                              </View>
                              <Text style={styles.deviceTsadi}>{device.kitName || device.tsadiNumber || 'ערכת שקד'}</Text>
                            </View>

                            <View style={styles.cardLocationRow}>
                              <TouchableOpacity 
                                style={styles.locationPill}
                                onPress={() => setEditingDevice(device)}
                                activeOpacity={0.8}
                              >
                                <Feather name="map-pin" size={12} color="#0284C7" />
                                <Text style={styles.locationPillText}>
                                  {device.location || 'הגדר מיקום'}
                                </Text>
                              </TouchableOpacity>

                              {hasAnyFault && (
                                <View style={styles.badgeInspection}>
                                  <Feather name="alert-circle" size={11} color="#B45309" />
                                  <Text style={styles.badgeInspectionText}>תקלה בערכה</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Direct Tactile Verification Checkbox */}
                        <View style={[
                          styles.checkToggle,
                          isVerified ? styles.checkToggleActive : styles.checkToggleInactive
                        ]}>
                          <MaterialCommunityIcons 
                            name={isVerified ? "check-bold" : "checkbox-blank-outline"} 
                            size={22} 
                            color={isVerified ? "#FFFFFF" : "#94A3B8"} 
                          />
                        </View>
                      </TouchableOpacity>

                      {/* 3 Kit Slots Display */}
                      <View style={styles.kitSlotsContainer}>
                        {/* Slot 1: טל 100 */}
                        <View style={styles.kitSlotRow}>
                          <View style={styles.kitSlotIcon}>
                            <Feather name="phone" size={11} color="#0284C7" />
                          </View>
                          <Text style={styles.kitSlotLabel}>טל 100:</Text>
                          <Text style={[styles.kitSlotValue, !tel100Tsadi && { color: '#94A3B8' }]}>
                            {tel100Tsadi ? `צ׳ ${tel100Tsadi}` : 'חסר'}
                          </Text>
                          {isVerified && <Text style={styles.slotVerifiedTag}>מאומת ✓</Text>}
                          {tel100Dev?.faultStatus && (
                            <View style={styles.slotFaultPill}>
                              <Text style={styles.slotFaultText}>{tel100Dev.faultStatus === 'replacement' ? 'להחלפה' : 'בדיקה'}</Text>
                            </View>
                          )}
                        </View>

                        {/* Slot 2: מבן */}
                        <View style={styles.kitSlotRow}>
                          <View style={styles.kitSlotIcon}>
                            <MaterialCommunityIcons name="power-plug" size={11} color="#0284C7" />
                          </View>
                          <Text style={styles.kitSlotLabel}>מבן:</Text>
                          <Text style={[styles.kitSlotValue, !mabanTsadi && { color: '#94A3B8' }]}>
                            {mabanTsadi ? `צ׳ ${mabanTsadi}` : 'חסר'}
                          </Text>
                          {isVerified && <Text style={styles.slotVerifiedTag}>מאומת ✓</Text>}
                          {mabanDev?.faultStatus && (
                            <View style={styles.slotFaultPill}>
                              <Text style={styles.slotFaultText}>{mabanDev.faultStatus === 'replacement' ? 'להחלפה' : 'בדיקה'}</Text>
                            </View>
                          )}
                        </View>

                        {/* Slot 3: טאבלט */}
                        <View style={styles.kitSlotRow}>
                          <View style={styles.kitSlotIcon}>
                            <Feather name="tablet" size={11} color="#0284C7" />
                          </View>
                          <Text style={styles.kitSlotLabel}>טאבלט:</Text>
                          <Text style={[styles.kitSlotValue, !tabletTsadi && { color: '#94A3B8' }]}>
                            {tabletTsadi ? `צ׳ ${tabletTsadi}` : 'חסר'}
                          </Text>
                          {isVerified && <Text style={styles.slotVerifiedTag}>מאומת ✓</Text>}
                          {tabletDev?.faultStatus && (
                            <View style={styles.slotFaultPill}>
                              <Text style={styles.slotFaultText}>{tabletDev.faultStatus === 'replacement' ? 'להחלפה' : 'בדיקה'}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }

                return (
                  <View style={[
                    styles.card,
                    isVerified && styles.cardVerified,
                    fault === 'inspection' && styles.cardInspection,
                    fault === 'replacement' && styles.cardReplacement
                  ]}>
                    {/* Primary Tap Area for instant verification */}
                    <TouchableOpacity 
                      style={styles.cardInteractiveRow}
                      activeOpacity={0.85}
                      onPress={() => device.id && handleVerifyDevice(device.id)}
                    >
                      {/* Right Column: Category Icon + Device Info */}
                      <View style={styles.cardInfoGroup}>
                        <View style={[
                          styles.catIconContainer,
                          isVerified ? styles.catIconVerified : styles.catIconPending
                        ]}>
                          <MaterialIcons 
                            name={cat.iconName as any} 
                            size={22} 
                            color={isVerified ? '#15803D' : '#0F172A'} 
                          />
                        </View>

                        <View style={styles.cardDetails}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.deviceTsadi}>צ׳ {device.tsadiNumber}</Text>
                            <Text style={styles.deviceType}>{device.type}</Text>
                          </View>

                          <View style={styles.cardLocationRow}>
                            <TouchableOpacity 
                              style={styles.locationPill}
                              onPress={() => setEditingDevice(device)}
                              activeOpacity={0.8}
                            >
                              <Feather name="map-pin" size={12} color="#0284C7" className="feather-map-pin" />
                              <Text style={styles.locationPillText}>
                                {device.location || 'הגדר מיקום'}
                              </Text>
                            </TouchableOpacity>

                            {device.linkedTsadi ? (
                              <View style={[styles.linkedMediaPill, isVerified && styles.linkedMediaPillVerified]}>
                                <Feather name="link-2" size={11} color={isVerified ? "#15803D" : "#0284C7"} />
                                <Text style={[styles.linkedMediaPillText, isVerified && { color: '#15803D', fontWeight: 'bold' }]}>
                                  {`תת-צ׳ מדיה: צ׳ ${device.linkedTsadi}${isVerified ? ' (מאומתת ✓)' : ''}`}
                                </Text>
                              </View>
                            ) : null}

                            {/* Fault indicators */}
                            {fault === 'inspection' && (
                              <View style={styles.badgeInspection}>
                                <Feather name="alert-circle" size={11} color="#B45309" />
                                <Text style={styles.badgeInspectionText}>בדיקת קשר</Text>
                              </View>
                            )}
                            {fault === 'replacement' && (
                              <View style={styles.badgeReplacement}>
                                <Feather name="alert-octagon" size={11} color="#B91C1C" />
                                <Text style={styles.badgeReplacementText}>דורש החלפה</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Left Column: Direct Tactile Verification Checkbox */}
                      <View style={[
                        styles.checkToggle,
                        isVerified ? styles.checkToggleActive : styles.checkToggleInactive
                      ]}>
                        <MaterialCommunityIcons 
                          name={isVerified ? "check-bold" : "checkbox-blank-outline"} 
                          size={22} 
                          color={isVerified ? "#FFFFFF" : "#94A3B8"} 
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }

              // MODE B: Full Equipment Inventory Card
              if (isKit) {
                return (
                  <View key={device.id || `${device.type}_${device.tsadiNumber}`}>
                    {categoryDivider}
                    <View style={[
                      styles.card,
                      styles.shakedKitCard,
                      hasAnyFault === 'inspection' && styles.cardInspection,
                      hasAnyFault === 'replacement' && styles.cardReplacement
                    ]}>
                    <View style={styles.inventoryTopRow}>
                      <View style={styles.cardInfoGroup}>
                        <View style={[styles.catIconContainer, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                          <MaterialCommunityIcons name="toolbox" size={22} color="#0284C7" />
                        </View>
                        <View style={styles.cardDetails}>
                          <View style={styles.cardTitleRow}>
                            <View style={styles.kitBadge}>
                              <Text style={styles.kitBadgeText}>ערכת שקד</Text>
                            </View>
                            <Text style={styles.deviceTsadi}>{device.kitName || device.tsadiNumber || 'ערכת שקד'}</Text>
                          </View>
                          <View style={styles.cardLocationRow}>
                            <TouchableOpacity 
                              style={styles.locationPill}
                              onPress={() => setEditingDevice(device)}
                              activeOpacity={0.8}
                            >
                              <Feather name="map-pin" size={12} color="#0284C7" />
                              <Text style={styles.locationPillText}>
                                {device.location || 'הגדר מיקום'}
                              </Text>
                            </TouchableOpacity>

                            {hasAnyFault && (
                              <View style={styles.badgeInspection}>
                                <Text style={styles.badgeInspectionText}>תקלה בערכה</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* 3 Kit Slots Display with reporting action */}
                    <View style={styles.kitSlotsContainer}>
                      {/* Slot 1: טל 100 */}
                      <View style={styles.kitSlotRow}>
                        <View style={styles.kitSlotIcon}>
                          <Feather name="phone" size={11} color="#0284C7" />
                        </View>
                        <Text style={styles.kitSlotLabel}>טל 100:</Text>
                        <Text style={[styles.kitSlotValue, !tel100Tsadi && { color: '#94A3B8' }]}>
                          {tel100Tsadi ? `צ׳ ${tel100Tsadi}` : 'חסר'}
                        </Text>
                        {tel100Dev && (
                          <TouchableOpacity 
                            style={styles.slotActionBtn}
                            onPress={() => {
                              setFaultModalDevice(tel100Dev);
                              setIsFaultModalVisible(true);
                            }}
                          >
                            <Feather name="alert-triangle" size={11} color={tel100Dev.faultStatus ? '#DC2626' : '#64748B'} />
                            <Text style={[styles.slotActionBtnText, tel100Dev.faultStatus && { color: '#DC2626' }]}>
                              {tel100Dev.faultStatus ? 'תקלה' : 'דווח'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Slot 2: מבן */}
                      <View style={styles.kitSlotRow}>
                        <View style={styles.kitSlotIcon}>
                          <MaterialCommunityIcons name="power-plug" size={11} color="#0284C7" />
                        </View>
                        <Text style={styles.kitSlotLabel}>מבן:</Text>
                        <Text style={[styles.kitSlotValue, !mabanTsadi && { color: '#94A3B8' }]}>
                          {mabanTsadi ? `צ׳ ${mabanTsadi}` : 'חסר'}
                        </Text>
                        {mabanDev && (
                          <TouchableOpacity 
                            style={styles.slotActionBtn}
                            onPress={() => {
                              setFaultModalDevice(mabanDev);
                              setIsFaultModalVisible(true);
                            }}
                          >
                            <Feather name="alert-triangle" size={11} color={mabanDev.faultStatus ? '#DC2626' : '#64748B'} />
                            <Text style={[styles.slotActionBtnText, mabanDev.faultStatus && { color: '#DC2626' }]}>
                              {mabanDev.faultStatus ? 'תקלה' : 'דווח'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Slot 3: טאבלט */}
                      <View style={styles.kitSlotRow}>
                        <View style={styles.kitSlotIcon}>
                          <Feather name="tablet" size={11} color="#0284C7" />
                        </View>
                        <Text style={styles.kitSlotLabel}>טאבלט:</Text>
                        <Text style={[styles.kitSlotValue, !tabletTsadi && { color: '#94A3B8' }]}>
                          {tabletTsadi ? `צ׳ ${tabletTsadi}` : 'חסר'}
                        </Text>
                        {tabletDev && (
                          <TouchableOpacity 
                            style={styles.slotActionBtn}
                            onPress={() => {
                              setFaultModalDevice(tabletDev);
                              setIsFaultModalVisible(true);
                            }}
                          >
                            <Feather name="alert-triangle" size={11} color={tabletDev.faultStatus ? '#DC2626' : '#64748B'} />
                            <Text style={[styles.slotActionBtnText, tabletDev.faultStatus && { color: '#DC2626' }]}>
                              {tabletDev.faultStatus ? 'תקלה' : 'דווח'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Location Action for Kit */}
                    <View style={styles.inventoryActionsRow}>
                      <TouchableOpacity 
                        style={styles.actionBtnSecondary}
                        onPress={() => setEditingDevice(device)}
                        activeOpacity={0.8}
                      >
                        <Feather name="map-pin" size={13} color="#0284C7" />
                        <Text style={styles.actionBtnSecondaryText}>עדכן מיקום ערכה</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                );
              }

              return (
                <View key={device.id || `${device.type}_${device.tsadiNumber}`}>
                  {categoryDivider}
                  <View style={[
                    styles.card,
                    fault === 'inspection' && styles.cardInspection,
                    fault === 'replacement' && styles.cardReplacement
                  ]}>
                  <View style={styles.inventoryTopRow}>
                    <View style={styles.cardInfoGroup}>
                      <View style={styles.catIconContainer}>
                        <MaterialIcons name={cat.iconName as any} size={22} color="#0F172A" />
                      </View>
                      <View style={styles.cardDetails}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.deviceTsadi}>צ׳ {device.tsadiNumber}</Text>
                          <Text style={styles.deviceType}>{device.type}</Text>
                        </View>
                        <View style={styles.cardLocationRow}>
                          <TouchableOpacity 
                            style={styles.locationPill}
                            onPress={() => setEditingDevice(device)}
                            activeOpacity={0.8}
                          >
                            <Feather name="map-pin" size={12} color="#0284C7" className="feather-map-pin" />
                            <Text style={styles.locationPillText}>
                              {device.location || 'הגדר מיקום'}
                            </Text>
                          </TouchableOpacity>

                          {device.linkedTsadi ? (
                            <View style={styles.linkedMediaPill}>
                              <Feather name="link-2" size={11} color="#0284C7" />
                              <Text style={styles.linkedMediaPillText}>
                                {`תת-צ׳ מדיה: צ׳ ${device.linkedTsadi}`}
                              </Text>
                            </View>
                          ) : null}

                          {fault === 'inspection' && (
                            <View style={styles.badgeInspection}>
                              <Text style={styles.badgeInspectionText}>בדיקת קשר</Text>
                            </View>
                          )}
                          {fault === 'replacement' && (
                            <View style={styles.badgeReplacement}>
                              <Text style={styles.badgeReplacementText}>דורש החלפה</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Consolidate Action Buttons */}
                  <View style={styles.inventoryActionsRow}>
                    <TouchableOpacity 
                      style={styles.actionBtnSecondary}
                      onPress={() => setEditingDevice(device)}
                      activeOpacity={0.8}
                    >
                      <Feather name="map-pin" size={13} color="#0284C7" />
                      <Text style={styles.actionBtnSecondaryText}>עדכן מיקום</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.actionBtnSecondary,
                        fault ? styles.actionBtnWarning : {}
                      ]}
                      onPress={() => {
                        setFaultModalDevice(device);
                        setIsFaultModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather 
                        name="alert-triangle" 
                        size={13} 
                        color={fault ? '#DC2626' : '#64748B'} 
                      />
                      <Text style={[
                        styles.actionBtnSecondaryText,
                        fault ? { color: '#DC2626', fontWeight: '700' } : {}
                      ]}>
                        {fault ? 'עדכן תקלה' : 'דווח תקלה'}
                      </Text>
                    </TouchableOpacity>

                    {fault && (
                      <TouchableOpacity 
                        style={styles.actionBtnSuccess}
                        onPress={() => confirmMarkFixed(device)}
                        activeOpacity={0.8}
                      >
                        <Feather name="check" size={13} color="#15803D" />
                        <Text style={styles.actionBtnSuccessText}>תוקן</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
              );
            }}
          />

          {/* Edit Location Modal */}
          <EditLocationModal
            visible={!!editingDevice}
            device={editingDevice}
            onClose={() => setEditingDevice(null)}
            onUpdate={() => {
              setEditingDevice(null);
              setSearchQuery('');
              setLocationFilter('הכל');
              fetchDevices();
            }}
          />

          {/* Platoon Event Log Modal */}
          <DailySummaryModal
            visible={isTimelineVisible}
            onClose={() => setIsTimelineVisible(false)}
            platoon={selectedPlatoon || undefined}
            dohId={selectedDohId || ''}
          />

          {/* Fault Reporting Modal */}
          <ReportFaultModal
            visible={isFaultModalVisible}
            initialDevice={faultModalDevice}
            onClose={() => {
              setIsFaultModalVisible(false);
              setFaultModalDevice(null);
            }}
            onSuccess={fetchDevices}
          />
        </View>
      ) : (
        /* Platoon Selector Card */
        <View style={styles.platoonSelectorWrap}>
          <View style={styles.selectorCard}>
            <View style={styles.selectorIconCircle}>
              <MaterialIcons name="shield" size={32} color="#15803D" />
            </View>
            <Text style={styles.selectorTitle}>בחר פלוגה להתחלת עבודה</Text>
            <Text style={styles.selectorSub}>בחר את הפלוגה שברצונך לאמת או לנהל את מצבת הציוד שלה</Text>
            <View style={styles.selectorDropdownWrap}>
              <SearchableDropdown
                data={getKashpalPlatoons()}
                value={selectedPlatoon || ''}
                onSelect={(val) => {
                  const clean = val.trim();
                  if (!clean) return;
                  learnNewOption('platoon', clean);
                  selectPlatoon(clean);
                }}
                placeholder="חפש או הקלד פלוגה חדשה..."
                allowFreeText={true}
              />
            </View>
          </View>
        </View>
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2200}
        message={snackbarMessage}
        actionLabel="הבנתי"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
    overflow: 'hidden',
  },
  mainScroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },

  /* 1. Tactical Command Header */
  commandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  headerRightBlock: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* 2. Operational Status Banners */
  activeSessionBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  beaconIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  bannerActiveText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressCountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4ADE80',
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  submitReportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingVertical: 12,
  },
  submitReportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  completedBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    marginBottom: 12,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  completedSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#166534',
    lineHeight: 16,
  },

  idleSessionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    marginBottom: 12,
  },
  idleTextGroup: {
    flex: 1,
  },
  idleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  idleSub: {
    fontSize: 12,
    color: '#64748B',
  },
  startSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#15803D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  startSessionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 3. Segmented Switcher */
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },

  /* 4. Search & Filters */
  searchSection: {
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 8,
  },
  searchIcon: {
    marginLeft: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  locationChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  locChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  locChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  locChipTextActive: {
    color: '#FFFFFF',
  },

  filterFeedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  filterFeedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  resetFilterLink: {
    padding: 2,
  },
  resetFilterLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Device Cards */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardVerified: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  cardInspection: {
    borderColor: '#FCD34D',
  },
  cardReplacement: {
    borderColor: '#FCA5A5',
  },
  cardInteractiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  catIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catIconVerified: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  catIconPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  cardDetails: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  deviceTsadi: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  locationPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  linkedMediaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  linkedMediaPillVerified: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  linkedMediaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  badgeInspection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeInspectionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  badgeReplacement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeReplacementText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },

  /* Tactile Verification Checkbox Toggle */
  checkToggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  checkToggleActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  checkToggleInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },

  /* Inventory Card specifics */
  inventoryTopRow: {
    marginBottom: 10,
  },
  inventoryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  actionBtnWarning: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Empty State */
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  emptyResetBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Platoon Selector View */
  platoonSelectorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  selectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectorDropdownWrap: {
    width: '100%',
    marginTop: 6,
  },
  selectorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  selectorSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },

  /* Shaked Kit Styles */
  shakedKitCard: {
    borderColor: '#BAE6FD',
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
    backgroundColor: '#FAFDFE',
  },
  kitBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  kitBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  kitSlotsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  kitSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kitSlotIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kitSlotLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    minWidth: 46,
  },
  kitSlotValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  slotVerifiedTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotFaultPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  slotFaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  slotActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  slotActionBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  categoryDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  categoryDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginHorizontal: 8,
    gap: 5,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
});
