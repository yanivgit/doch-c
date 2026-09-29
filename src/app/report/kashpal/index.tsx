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
  subscribeToVerifiedDevices 
} from '../../../firebase/api';
import { db } from '../../../firebase/config';
import { onSnapshot, doc, collection, query, where } from 'firebase/firestore';
import SearchableDropdown from '../../../components/SearchableDropdown';
import EditLocationModal from '../../../components/EditLocationModal';
import TransferDeviceModal from '../../../components/TransferDeviceModal';
import DailySummaryModal from '../../../components/DailySummaryModal';
import ReportFaultModal from '../../../components/ReportFaultModal';
import ReplaceDeviceModal from '../../../components/ReplaceDeviceModal';
import Snackbar from '../../../components/Snackbar';
import OfflineBanner from '../../../components/OfflineBanner';
import { PLUGOT } from '../../../constants/data';

export default function KashpalReportScreen() {
  const router = useRouter();
  const { selectedDohId, selectedPlatoon, selectPlatoon, logout } = useApp();
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [verifiedDevicesMap, setVerifiedDevicesMap] = useState<Record<string, { verifiedAt: any; verifiedBy: string }>>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('לחץ לחיצה ארוכה כדי לסמן ציוד כנמצא');
  
  // Modals state
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [transferringDevice, setTransferringDevice] = useState<Device | null>(null);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);
  const [faultModalDevice, setFaultModalDevice] = useState<Device | null>(null);
  const [isFaultModalVisible, setIsFaultModalVisible] = useState(false);
  const [replacingDevice, setReplacingDevice] = useState<Device | null>(null);
  
  // Tactical Mode & Filter states
  // Mode A: 'report' ("דו"ח פעיל") - Verification UI or Completed Success State
  // Mode B: 'inventory' ("רשימת ציוד") - Clean read-only inventory, prominent search & dynamic location filters
  const [activeTab, setActiveTab] = useState<'report' | 'inventory'>('report');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('הכל');

  // Pulse animation value for active session indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch platoon devices (fallback / manual refresh)
  const fetchDevices = useCallback(async () => {
    if (!selectedPlatoon || !selectedDohId) return;
    try {
      const platoonDevices = await getDevicesByPlatoonAndDohId(selectedPlatoon, selectedDohId);
      setDevices(platoonDevices);
    } catch (error) {
      console.error("Error fetching devices manually:", error);
    }
  }, [selectedPlatoon, selectedDohId]);

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
        Alert.alert('שגיאה', 'לא הצלחנו לטעון את הציוד. נסה שוב מאוחר יותר.');
      }
    );

    return () => {
      unsubscribe();
    };
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
        if (sessionData.globalStatus === 'archived') {
          setActiveSession(null);
        } else {
          setActiveSession(sessionData);
        }
      } catch (error) {
        console.error("Error processing snapshot:", error);
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      Alert.alert('שגיאה', 'אבד החיבור לשרת. מנסה להתחבר מחדש...');
    });

    return () => unsubscribe();
  }, [selectedDohId]);

  // Real-time synchronization for verified devices subcollection
  // Firestore query constraint: where('platoon', '==', selectedPlatoon) ensures Kashpal only listens to their own platoon
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

    return () => {
      unsubscribe();
    };
  }, [activeSession?.id, selectedPlatoon]);

  // Status checks for current platoon in today's daily session
  const isMyPlatoonCompleted = useMemo(() => {
    return activeSession?.platoons?.[selectedPlatoon || '']?.status === 'completed';
  }, [activeSession, selectedPlatoon]);

  const isMyPlatoonActive = useMemo(() => {
    if (isMyPlatoonCompleted) return false;
    return (
      activeSession?.platoons?.[selectedPlatoon || '']?.status === 'active' || 
      activeSession?.globalStatus === 'active'
    );
  }, [activeSession, selectedPlatoon, isMyPlatoonCompleted]);

  const canVerify = isMyPlatoonActive && !isMyPlatoonCompleted;

  // Pulse animation for active session (runs ONLY when canVerify is true, with strict stop() cleanup to prevent battery drain)
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

    return () => {
      animation.stop();
    };
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
    if (t.includes('קשר') || t.includes('710') || t.includes('סלולר') || t.includes('אולר') || t.includes('טל')) {
      return { tag: 'קשר', iconName: 'radio', isCommunity: false, isMaterial: true };
    }
    if (t.includes('אופטיקה') || t.includes('ראי') || t.includes('נר') || t.includes('מג"ס') || t.includes('מג״ס') || t.includes('אמר')) {
      return { tag: 'אופטיקה', iconName: 'military-tech', isCommunity: false, isMaterial: true };
    }
    if (t.includes('רפואה') || t.includes('עזרה') || t.includes('חובש') || t.includes('ערכת')) {
      return { tag: 'רפואה', iconName: 'medical-bag', isCommunity: true, isMaterial: false };
    }
    if (t.includes('ניווט') || t.includes('לוויין') || t.includes('טאבלט') || t.includes('סיאף') || t.includes('מחשב')) {
      return { tag: 'ניווט', iconName: 'satellite-variant', isCommunity: true, isMaterial: false };
    }
    return { tag: 'ציוד', iconName: 'devices', isCommunity: false, isMaterial: true };
  };

  // Extract unique existing locations from current platoon's devices
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    devices.forEach(d => {
      const loc = d.location?.trim();
      if (loc) {
        locSet.add(loc);
      }
    });
    return Array.from(locSet).sort((a, b) => a.localeCompare(b));
  }, [devices]);

  // Filter & sort logic (Location-based sorting + Tsadi/Location/Type search)
  const filteredAndSortedDevices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    let filtered = devices.filter(d => {
      // Filter by selected location if not 'הכל' (applies to BOTH report and inventory tabs)
      if (locationFilter !== 'הכל') {
        if (d.location?.trim() !== locationFilter) return false;
      }

      if (!query) return true;
      const tsadiMatch = d.tsadiNumber?.toLowerCase().includes(query);
      const locMatch = d.location?.toLowerCase().includes(query);
      const typeMatch = d.type?.toLowerCase().includes(query);
      return tsadiMatch || locMatch || typeMatch;
    });

    return filtered.sort((a, b) => {
      if (activeTab === 'report') {
        const isVerifiedA = !!(a.id && (verifiedDevicesMap[a.id] || activeSession?.verifiedDevices?.[a.id]));
        const isVerifiedB = !!(b.id && (verifiedDevicesMap[b.id] || activeSession?.verifiedDevices?.[b.id]));
        if (isVerifiedA !== isVerifiedB) {
          return isVerifiedA ? 1 : -1;
        }
      }

      const locA = a.location?.trim() || '';
      const locB = b.location?.trim() || '';
      if (!locA && !locB) return 0;
      if (!locA) return 1;
      if (!locB) return -1;
      return locA.localeCompare(locB);
    });
  }, [devices, searchQuery, locationFilter, activeSession, activeTab, verifiedDevicesMap]);

  // Devices to display in FlatList
  // When report is completed in Mode A, checklist is completely hidden
  const displayDevices = useMemo(() => {
    if (activeTab === 'report' && isMyPlatoonCompleted) {
      return [];
    }
    return filteredAndSortedDevices;
  }, [activeTab, isMyPlatoonCompleted, filteredAndSortedDevices]);

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
          { 
            text: 'נעל דו"ח עם חוסרים', 
            style: 'destructive',
            onPress: performEnd
          }
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
          { 
            text: 'נעל ושלח דיווח', 
            style: 'default',
            onPress: performEnd
          }
        ]
      );
    }
  };

  const handleVerifyDevice = async (deviceId: string) => {
    if (!activeSession || !activeSession.id || !selectedPlatoon) return;
    try {
      const isAlreadyVerified = !!(verifiedDevicesMap[deviceId] || activeSession?.verifiedDevices?.[deviceId]);
      if (isAlreadyVerified) {
        await unverifyDevice(activeSession.id, deviceId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSnackbarMessage('אימות המכשיר בוטל');
        setSnackbarVisible(true);
      } else {
        await verifyDevice(activeSession.id, deviceId, `קשפ"ל_${selectedPlatoon}`, selectedPlatoon);
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
      
      {/* 1. Top Header Row: In RTL, Child 1 is on the RIGHT, Child 2 is on the LEFT */}
      <View style={styles.headerTop}>
        {/* Child 1 (RIGHT): Green Decagram Badge + Titles */}
        <View style={styles.headerTopRight}>
          <View style={styles.checkBadgeBox}>
            <MaterialCommunityIcons name="check-decagram" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.headerTitleColumn}>
            <Text style={styles.headerTopSubtitle}>דו"ח ציוד מבצעי • מחזור א'</Text>
            <Text style={styles.headerTopTitle}>Field Checklist</Text>
          </View>
        </View>

        {/* Child 2 (LEFT): Red logout toward inside, Green user circle at the far left edge */}
        <View style={styles.headerTopLeft}>
          <TouchableOpacity style={styles.iconBtnLogout} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#DC2626" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.userCircleBtn}>
            <Feather name="user" size={18} color="#FFFFFF" />
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
            data={displayDevices}
            keyExtractor={(device) => device.id || device.tsadiNumber}
            ListHeaderComponent={
              <View>
                {/* 1. Top Header Card */}
                <View style={styles.overviewCard}>
                  {/* Top Row: Right side icon box + titles, Left side status badge */}
                  <View style={styles.overviewCardHeader}>
                    {/* Right side in RTL */}
                    <View style={styles.overviewTitleRow}>
                      <View style={styles.overviewIconBox}>
                        <MaterialCommunityIcons 
                          name={isMyPlatoonCompleted ? "checkbox-marked-circle" : "checkbox-marked-outline"} 
                          size={24} 
                          color="#15803D" 
                        />
                      </View>
                      <View style={styles.overviewTextCol}>
                        <Text style={styles.overviewSub}>קשפ"ל מבצעי</Text>
                        <Text style={styles.overviewMainTitle}>מסדר אימות ציוד</Text>
                      </View>
                    </View>

                    {/* Left side in RTL: Status pill */}
                    <View style={isMyPlatoonCompleted ? styles.completedStatusPill : styles.operationalStatusPill}>
                      <View style={isMyPlatoonCompleted ? styles.opGreenDot : styles.opRedDot} />
                      <Text style={isMyPlatoonCompleted ? styles.completedStatusText : styles.opStatusText}>
                        {isMyPlatoonCompleted ? 'הושלם בהצלחה' : 'סבב: 5 ש"ח'}
                      </Text>
                    </View>
                  </View>

                  {/* 2. Segmented Control (Tabs): Mode A ("דו"ח פעיל") vs Mode B ("רשימת ציוד") */}
                  <View style={styles.tabSwitcher}>
                    <TouchableOpacity 
                      style={[styles.tabButton, activeTab === 'report' && styles.tabButtonActive]}
                      onPress={() => setActiveTab('report')}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons 
                        name="clipboard-check-outline" 
                        size={17} 
                        color={activeTab === 'report' ? '#15803D' : '#64748B'} 
                        style={{ marginLeft: 6 }}
                      />
                      <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
                        דו"ח פעיל
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.tabButton, activeTab === 'inventory' && styles.tabButtonActive]}
                      onPress={() => setActiveTab('inventory')}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons 
                        name="format-list-bulleted" 
                        size={17} 
                        color={activeTab === 'inventory' ? '#15803D' : '#64748B'} 
                        style={{ marginLeft: 6 }}
                      />
                      <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>
                        רשימת ציוד
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 3. Platoon Status / Inventory Status Bar */}
                  <View style={styles.overviewInfoRow}>
                    {/* Right side in RTL */}
                    <View style={styles.overviewInfoRight}>
                      <MaterialCommunityIcons name="shield-outline" size={17} color="#15803D" />
                      <Text style={styles.overviewInfoText}>
                        מצאי ציוד: {selectedPlatoon}
                      </Text>
                    </View>

                    {/* Left side in RTL */}
                    <View style={styles.itemCountBadge}>
                      <Text style={styles.itemCountText}>
                        {activeTab === 'report' 
                          ? (isMyPlatoonCompleted 
                              ? `${verifiedCount}/${devices.length} אומתו (הושלם)` 
                              : `${verifiedCount}/${devices.length} אומתו`)
                          : `${devices.length} פריטים במצאי`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 3. Active Report Card (Mode A) */}
                {activeTab === 'report' && (
                  isMyPlatoonCompleted ? (
                    verifiedCount === devices.length && devices.length > 0 ? (
                      /* SUCCESS UI STATE WHEN REPORT IS 100% COMPLETED */
                      <View style={styles.successCard}>
                        {/* Large Green Checkmark Icon */}
                        <View style={styles.successIconOuterCircle}>
                          <View style={styles.successIconInnerCircle}>
                            <MaterialCommunityIcons name="check-decagram" size={44} color="#FFFFFF" />
                          </View>
                        </View>

                        {/* Success Message: סיימת דו"ח לתאריך [DD.MM] */}
                        <Text style={styles.successTitleText}>
                          סיימת דו"ח לתאריך {formattedDate}
                        </Text>

                        <Text style={styles.successSubtitleText}>
                          כל פריטי הציוד של {selectedPlatoon} נבדקו ואושרו בהצלחה. הדיווח ננעל ומסונכרן מול הקשר"ג.
                        </Text>

                        {/* Details Summary Card */}
                        <View style={styles.successDetailsCard}>
                          <View style={styles.successDetailRow}>
                            <MaterialCommunityIcons name="shield-check" size={20} color="#15803D" />
                            <Text style={styles.successDetailText}>
                              סטטוס דיווח: הושלם ומאושר
                            </Text>
                          </View>
                          <View style={styles.successDetailDivider} />
                          <View style={styles.successDetailRow}>
                            <MaterialIcons name="devices" size={20} color="#1E40AF" />
                            <Text style={styles.successDetailText}>
                              סה״כ פריטים שאומתו: {verifiedCount} מתוך {devices.length}
                            </Text>
                          </View>
                        </View>

                        {/* Quick Action: View Equipment List */}
                        <TouchableOpacity 
                          style={styles.viewInventoryBtn}
                          onPress={() => setActiveTab('inventory')}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#15803D" />
                          <Text style={styles.viewInventoryBtnText}>צפייה ברשימת הציוד המלאה</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* WARNING UI STATE WHEN REPORT IS COMPLETED WITH MISSING ITEMS */
                      <View style={styles.incompleteCard}>
                        {/* Amber/Orange Alert Icon */}
                        <View style={styles.incompleteIconOuterCircle}>
                          <View style={styles.incompleteIconInnerCircle}>
                            <MaterialCommunityIcons name="shield-alert" size={40} color="#FFFFFF" />
                          </View>
                        </View>

                        {/* Message: הדו"ח ננעל עם חוסרים לתאריך [DD.MM] */}
                        <Text style={styles.incompleteTitleText}>
                          הדו"ח ננעל עם חוסרים לתאריך {formattedDate}
                        </Text>

                        <Text style={styles.incompleteSubtitleText}>
                          דו"ח {selectedPlatoon} ננעל ונשלח לקשר"ג עם {devices.length - verifiedCount} פריטים שלא אותרו/נבדקו.
                        </Text>

                        {/* Details Summary Card */}
                        <View style={styles.incompleteDetailsCard}>
                          <View style={styles.successDetailRow}>
                            <MaterialCommunityIcons name="alert-octagon" size={20} color="#D97706" />
                            <Text style={[styles.successDetailText, { color: '#B45309' }]}>
                              סטטוס דיווח: הסתיים עם חוסרים ({devices.length - verifiedCount} לא נבדקו)
                            </Text>
                          </View>
                          <View style={styles.successDetailDivider} />
                          <View style={styles.successDetailRow}>
                            <MaterialIcons name="devices" size={20} color="#D97706" />
                            <Text style={styles.successDetailText}>
                              סה״כ פריטים שאומתו: {verifiedCount} מתוך {devices.length}
                            </Text>
                          </View>
                        </View>

                        {/* Quick Action: View Equipment List */}
                        <TouchableOpacity 
                          style={styles.incompleteViewInventoryBtn}
                          onPress={() => setActiveTab('inventory')}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#D97706" />
                          <Text style={styles.incompleteViewInventoryBtnText}>צפייה ברשימת הציוד והחוסרים</Text>
                        </TouchableOpacity>
                        
                        <Text style={styles.reopenHintText}>
                          לפתיחה מחדש להמשך אימות, יש לפנות לקשר"ג.
                        </Text>
                      </View>
                    )
                  ) : (
                    /* ACTIVE REPORT VERIFICATION UI */
                    canVerify ? (
                      <View style={styles.sessionCard}>
                        {/* Header: Title with pulsing red dot on right, Progress on left */}
                        <View style={styles.sessionCardHeader}>
                          <View style={styles.sessionTitleGroup}>
                            <Animated.View style={[styles.sessionRedDot, { opacity: pulseAnim }]} />
                            <Text style={styles.sessionTitleText}>
                              יש דו"ח פעיל!
                            </Text>
                          </View>

                          <View style={styles.progressCounterGroup}>
                            <Text style={styles.progressCounterLabel}>התקדמות</Text>
                            <Text style={styles.progressCounterValue}>
                              {verifiedCount}/{devices.length}
                            </Text>
                          </View>
                        </View>

                        {/* Instruction row with hand pointer icon */}
                        <View style={styles.sessionInstructionRow}>
                          <MaterialIcons name="touch-app" size={18} color="#D97706" />
                          <Text style={styles.sessionInstructionText}>
                            לחץ לחיצה ארוכה על מקלט לאישור פיזי של כל פריט
                          </Text>
                        </View>

                        {/* Progress Bar (Fills from right in RTL) */}
                        <View style={styles.progressBarTrack}>
                          <View 
                            style={[
                              styles.progressBarFill, 
                              { width: `${progressPercent}%` }
                            ]} 
                          />
                        </View>

                        {/* Large Green Bottom Button: סיימתי דיווח */}
                        <TouchableOpacity 
                          style={styles.finishSessionBtn} 
                          onPress={handleEndSession}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="check-decagram" size={20} color="#FFFFFF" />
                          <Text style={styles.finishSessionBtnText}>סיימתי דיווח</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.noSessionCard}>
                        <Feather name="info" size={24} color="#334155" style={{ marginBottom: 6 }} />
                        <Text style={styles.noSessionTitle}>אין דו"ח פעיל כרגע</Text>
                        <Text style={styles.noSessionSub}>התחל דו"ח כדי לאשר את ציוד הפלוגה</Text>
                        <TouchableOpacity 
                          style={styles.startSessionBtn} 
                          onPress={handleStartSession}
                          activeOpacity={0.85}
                        >
                          <Feather name="play" size={16} color="#FFFFFF" />
                          <Text style={styles.startSessionBtnText}>התחל דו"ח עצמאי</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  )
                )}

                {/* 4. Search Bar & Location Filter Section (placed directly above the Equipment List) */}
                {!(activeTab === 'report' && isMyPlatoonCompleted) && (
                  <View style={styles.searchFilterSection}>
                    {/* Search Bar */}
                    <View style={styles.prominentSearchBar}>
                      <Feather name="search" size={19} color="#15803D" style={styles.searchIcon} />
                      <TextInput
                        style={styles.prominentSearchInput}
                        placeholder="חיפוש מהיר לפי צדיק, סוג או מיקום..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        textAlign="right"
                        placeholderTextColor="#64748B"
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                          <Feather name="x" size={17} color="#334155" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Dynamic Location Filter Chips */}
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryChipsContainer}
                    >
                      <TouchableOpacity
                        key="all"
                        style={[styles.chipButton, locationFilter === 'הכל' && styles.chipButtonActive]}
                        onPress={() => setLocationFilter('הכל')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, locationFilter === 'הכל' && styles.chipTextActive]}>
                          הכל
                        </Text>
                      </TouchableOpacity>

                      {uniqueLocations.map((loc) => {
                        const isSelected = locationFilter === loc;
                        return (
                          <TouchableOpacity
                            key={loc}
                            style={[styles.chipButton, isSelected && styles.chipButtonActive]}
                            onPress={() => setLocationFilter(loc)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                              {loc}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* 5. The Equipment List Section Header */}
                {!(activeTab === 'report' && isMyPlatoonCompleted) && (
                  <View style={styles.listSectionHeader}>
                    <Text style={styles.listSectionTitle}>
                      {activeTab === 'report' 
                        ? `פריטי ביקורת לפלוגה ${selectedPlatoon}` 
                        : `רשימת ציוד לפלוגה ${selectedPlatoon}`}
                      {(searchQuery.trim().length > 0 || locationFilter !== 'הכל') 
                        ? ` (${filteredAndSortedDevices.length})` 
                        : ` (${devices.length})`}
                    </Text>
                    {(searchQuery.trim().length > 0 || locationFilter !== 'הכל') && (
                      <TouchableOpacity onPress={resetFilters} style={styles.resetFilterBtn}>
                        <Text style={styles.resetFilterText}>איפוס סינונים</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              (activeTab === 'report' && isMyPlatoonCompleted) ? null : (
                <View style={styles.emptyContainer}>
                  <Feather name="inbox" size={36} color="#64748B" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyText}>
                    {loading 
                      ? 'טוען פריטים...' 
                      : (searchQuery.trim() || locationFilter !== 'הכל' 
                        ? 'לא נמצאו תוצאות לחיפוש/סינון הנוכחי.' 
                        : 'לא נמצא ציוד לפלוגה זו.')}
                  </Text>
                  {(searchQuery.trim().length > 0 || locationFilter !== 'הכל') && (
                    <TouchableOpacity onPress={resetFilters} style={[styles.resetFilterBtn, { marginTop: 8 }]}>
                      <Text style={[styles.resetFilterText, { fontSize: 13 }]}>איפוס חיפוש וסינון</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            }
            renderItem={({ item: device }) => {
              const isVerified = !!(device.id && (verifiedDevicesMap[device.id] || activeSession?.verifiedDevices?.[device.id]));
              const cat = getDeviceCategory(device.type);
              const fault = device.faultStatus;

              // MODE A: Full verification card with checkboxes, pills, and long-press
              if (activeTab === 'report') {
                return (
                  <TouchableOpacity
                    style={[
                      styles.deviceCard,
                      isVerified && styles.deviceCardVerified,
                      fault === 'inspection' && styles.deviceCardInspection,
                      fault === 'replacement' && styles.deviceCardReplacement
                    ]}
                    activeOpacity={0.8}
                    delayLongPress={400}
                    onPress={() => {
                      if (!activeSession) {
                        setSnackbarMessage('יש להתחיל או להמתין להפעלת דו"ח כדי לאמת ציוד');
                        setSnackbarVisible(true);
                      } else if (canVerify) {
                        setSnackbarMessage('לחץ לחיצה ארוכה לאימות ציוד');
                        setSnackbarVisible(true);
                      }
                    }}
                    onLongPress={() => {
                      if (canVerify && device.id) {
                        handleVerifyDevice(device.id);
                      }
                    }}
                  >
                    {/* Right side in RTL: Icon Box + Details */}
                    <View style={styles.deviceRightSide}>
                      <View style={[
                        styles.deviceIconBox,
                        isVerified ? styles.deviceIconBoxVerified : styles.deviceIconBoxPending,
                        fault === 'inspection' && styles.deviceIconBoxInspection,
                        fault === 'replacement' && styles.deviceIconBoxReplacement
                      ]}>
                        {cat.isCommunity ? (
                          <MaterialCommunityIcons 
                            name={cat.iconName as any} 
                            size={24} 
                            color={fault === 'replacement' ? '#DC2626' : (fault === 'inspection' ? '#D97706' : (isVerified ? '#15803D' : '#4F46E5'))} 
                          />
                        ) : (
                          <MaterialIcons 
                            name={cat.iconName as any} 
                            size={24} 
                            color={fault === 'replacement' ? '#DC2626' : (fault === 'inspection' ? '#D97706' : (isVerified ? '#15803D' : '#4F46E5'))} 
                          />
                        )}
                      </View>

                      <View style={styles.deviceInfoColumn}>
                        <View style={styles.deviceTitleRow}>
                          <Text style={[styles.deviceTitleText, isVerified && styles.deviceTitleVerified]}>
                            {device.type}
                          </Text>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{cat.tag}</Text>
                          </View>
                          {/* Fault Indicators */}
                          {fault === 'inspection' && (
                            <View style={styles.faultBadgeInspection}>
                              <Feather name="alert-circle" size={11} color="#B45309" />
                              <Text style={styles.faultBadgeTextInspection}>דרושה בדיקת קשר</Text>
                            </View>
                          )}
                          {fault === 'replacement' && (
                            <TouchableOpacity 
                              style={styles.faultBadgeReplacement}
                              onPress={() => setReplacingDevice(device)}
                              activeOpacity={0.7}
                            >
                              <Feather name="alert-octagon" size={11} color="#B91C1C" />
                              <Text style={styles.faultBadgeTextReplacement}>דורש החלפה</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.deviceSubtitleText}>
                          <Text style={styles.tsadiHighlightText}>צ': {device.tsadiNumber}</Text> • מיקום: {device.location || 'ללא מיקום'}
                        </Text>
                      </View>
                    </View>

                    {/* Left side in RTL: Status Button / Badge + Edit location */}
                    <View style={styles.deviceLeftSide}>
                      <TouchableOpacity 
                        style={styles.editLocationBtn}
                        onPress={() => setEditingDevice(device)}
                      >
                        <Feather name="map-pin" size={16} color="#334155" />
                      </TouchableOpacity>

                      {isVerified ? (
                        <TouchableOpacity 
                          style={styles.verifiedPill}
                          onPress={() => {
                            if (canVerify) {
                              setSnackbarMessage('לחץ לחיצה ארוכה לביטול/שינוי אימות');
                              setSnackbarVisible(true);
                            }
                          }}
                          onLongPress={() => {
                            if (canVerify && device.id) {
                              handleVerifyDevice(device.id);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Feather name="check-circle" size={14} color="#15803D" />
                          <Text style={styles.verifiedPillText}>מאושר</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={styles.pendingPill}
                          onPress={() => {
                            if (canVerify) {
                              setSnackbarMessage('לחץ לחיצה ארוכה לאימות ציוד');
                              setSnackbarVisible(true);
                            }
                          }}
                          onLongPress={() => {
                            if (canVerify && device.id) {
                              handleVerifyDevice(device.id);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Feather name="circle" size={14} color="#334155" />
                          <Text style={styles.pendingPillText}>ממתין</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }

              // MODE B: Clean Read-Only Inventory Card
              return (
                <View style={[
                  styles.inventoryCard,
                  fault === 'inspection' && styles.inventoryCardInspection,
                  fault === 'replacement' && styles.inventoryCardReplacement
                ]}>
                  {/* Right side in RTL: Category Icon + Equipment Info */}
                  <View style={styles.deviceRightSide}>
                    <View style={[
                      styles.inventoryIconBox,
                      fault === 'inspection' && styles.deviceIconBoxInspection,
                      fault === 'replacement' && styles.deviceIconBoxReplacement
                    ]}>
                      {cat.isCommunity ? (
                        <MaterialCommunityIcons 
                          name={cat.iconName as any} 
                          size={22} 
                          color={fault === 'replacement' ? '#DC2626' : (fault === 'inspection' ? '#D97706' : '#1E6B3A')} 
                        />
                      ) : (
                        <MaterialIcons 
                          name={cat.iconName as any} 
                          size={22} 
                          color={fault === 'replacement' ? '#DC2626' : (fault === 'inspection' ? '#D97706' : '#1E6B3A')} 
                        />
                      )}
                    </View>

                    <View style={styles.deviceInfoColumn}>
                      <View style={styles.deviceTitleRow}>
                        <Text style={styles.inventoryTitleText}>
                          {device.type}
                        </Text>
                        <View style={styles.inventoryCategoryBadge}>
                          <Text style={styles.inventoryCategoryText}>{cat.tag}</Text>
                        </View>
                        {/* Fault Indicators */}
                        {fault === 'inspection' && (
                          <View style={styles.faultBadgeInspection}>
                            <Feather name="alert-circle" size={11} color="#B45309" />
                            <Text style={styles.faultBadgeTextInspection}>דרושה בדיקת קשר</Text>
                          </View>
                        )}
                        {fault === 'replacement' && (
                          <TouchableOpacity 
                            style={styles.faultBadgeReplacement}
                            onPress={() => setReplacingDevice(device)}
                            activeOpacity={0.7}
                          >
                            <Feather name="alert-octagon" size={11} color="#B91C1C" />
                            <Text style={styles.faultBadgeTextReplacement}>דורש החלפה</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Meta Tags: Tsadi & Location */}
                      <View style={styles.inventoryMetaRow}>
                        <View style={styles.tsadiTag}>
                          <Feather name="hash" size={12} color="#0F172A" />
                          <Text style={styles.tsadiTagText}>צ' {device.tsadiNumber}</Text>
                        </View>
                        <View style={styles.locationTag}>
                          <Feather name="map-pin" size={12} color="#0284C7" />
                          <Text style={styles.locationTagText}>
                            {device.location || 'ללא מיקום מוגדר'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Left side in RTL: Transfer + Fault + Quick edit location */}
                  <View style={styles.deviceLeftSide}>
                    <TouchableOpacity 
                      style={styles.inventoryTransferBtn}
                      onPress={() => setTransferringDevice(device)}
                      activeOpacity={0.8}
                    >
                      <Feather name="repeat" size={13} color="#15803D" />
                      <Text style={styles.inventoryTransferBtnText}>העבר</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.inventoryFaultBtn,
                        fault && styles.inventoryFaultBtnActive
                      ]}
                      onPress={() => {
                        if (fault === 'replacement') {
                          setReplacingDevice(device);
                        } else {
                          setFaultModalDevice(device);
                          setIsFaultModalVisible(true);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather 
                        name="alert-triangle" 
                        size={13} 
                        color={fault === 'replacement' ? '#DC2626' : (fault === 'inspection' ? '#D97706' : '#334155')} 
                      />
                      <Text style={[
                        styles.inventoryFaultBtnText,
                        fault === 'replacement' ? { color: '#DC2626' } : (fault === 'inspection' ? { color: '#D97706' } : {})
                      ]}>
                        תקלה
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.inventoryEditBtn}
                      onPress={() => setEditingDevice(device)}
                      activeOpacity={0.8}
                    >
                      <Feather name="edit-2" size={13} color="#334155" />
                      <Text style={styles.inventoryEditBtnText}>מיקום</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <View style={styles.syncFooter}>
                <Feather name="cloud" size={14} color="#334155" />
                <Text style={styles.syncFooterText}>
                  {activeTab === 'report' 
                    ? (isMyPlatoonCompleted ? `דו"ח ${formattedDate} הושלם בהצלחה` : 'סנכרון מקומי פעיל') 
                    : 'מאגר ציוד פלוגתי'} • עודכן אחרון {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • סה״כ {devices.length} פריטים
                </Text>
              </View>
            }
          />

          {/* Edit Location Modal */}
          <EditLocationModal
            visible={!!editingDevice}
            device={editingDevice}
            onClose={() => setEditingDevice(null)}
            onUpdate={() => {
              setEditingDevice(null);
              fetchDevices();
            }}
          />

          {/* Transfer Device Modal */}
          <TransferDeviceModal
            visible={!!transferringDevice}
            device={transferringDevice}
            onClose={() => setTransferringDevice(null)}
            onTransfer={() => {
              if (transferringDevice?.id) {
                const removedId = transferringDevice.id;
                // Instantly remove the transferred item from current Kashpal's list
                setDevices(prev => prev.filter(d => d.id !== removedId));
              }
              setTransferringDevice(null);
              fetchDevices();
            }}
          />

          {/* Platoon-Specific Event Log / Timeline Modal */}
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

          {/* Brigade Replacement Modal */}
          <ReplaceDeviceModal
            visible={!!replacingDevice}
            device={replacingDevice}
            onClose={() => setReplacingDevice(null)}
            onReplaced={fetchDevices}
          />
        </View>
      ) : (
        <View style={styles.platoonSelectorContainer}>
          <View style={styles.selectorCard}>
            <Text style={styles.selectorTitle}>בחר פלוגה לתצוגה</Text>
            <SearchableDropdown
              data={PLUGOT as unknown as string[]}
              value={selectedPlatoon || ''}
              onSelect={selectPlatoon}
              placeholder="חפש ובחר פלוגה..."
            />
          </View>
        </View>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* Child 1 (Rightmost): קשפ"ל (active) */}
        <TouchableOpacity style={styles.navItem} activeOpacity={1}>
          <MaterialCommunityIcons name="archive" size={22} color="#15803D" />
          <Text style={[styles.navText, styles.navTextActive]}>קשפ"ל</Text>
        </TouchableOpacity>

        {/* Child 2: יומן אירועים (Event Log) */}
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setIsTimelineVisible(true)}
        >
          <Feather name="clipboard" size={20} color="#334155" />
          <Text style={styles.navText}>יומן אירועים</Text>
        </TouchableOpacity>

        {/* Child 3: דיווח תקלה */}
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => {
            setFaultModalDevice(null);
            setIsFaultModalVisible(true);
          }}
        >
          <Feather name="alert-triangle" size={20} color="#334155" />
          <Text style={styles.navText}>דיווח תקלה</Text>
        </TouchableOpacity>

        {/* Child 4 (Leftmost): כניסה / התנתקות */}
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={handleLogout}
        >
          <MaterialIcons name="badge" size={22} color="#334155" />
          <Text style={styles.navText}>כניסה</Text>
        </TouchableOpacity>
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2500}
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
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  /* Header Top */
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBadgeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    alignItems: 'flex-start',
  },
  headerTopSubtitle: {
    fontSize: 10,
    color: '#334155',
    textAlign: 'right',
    fontWeight: '600',
  },
  headerTopTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  headerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnLogout: {
    padding: 6,
  },
  userCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Overview Card */
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  overviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overviewIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTextCol: {
    alignItems: 'flex-start',
  },
  overviewSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  overviewMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  operationalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 6,
  },
  completedStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 6,
  },
  opRedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  opGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#15803D',
  },
  opStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  completedStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Segmented Control Tabs */
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  /* Inventory Status Bar */
  overviewInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overviewInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overviewInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemCountBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  itemCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  /* Success Completed Card */
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  successIconOuterCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#DCFCE7',
    borderWidth: 4,
    borderColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  successTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitleText: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  successDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 20,
  },
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successDetailText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  successDetailDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  viewInventoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    width: '100%',
  },
  viewInventoryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },

  /* Incomplete Card Styles */
  incompleteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.4)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  incompleteIconOuterCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FEF3C7',
    borderWidth: 4,
    borderColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  incompleteIconInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  incompleteTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 8,
  },
  incompleteSubtitleText: {
    fontSize: 13,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  incompleteDetailsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 20,
  },
  incompleteViewInventoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    width: '100%',
    marginBottom: 10,
  },
  incompleteViewInventoryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  reopenHintText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },

  /* Active Session Card */
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  sessionTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressCounterGroup: {
    alignItems: 'flex-start',
  },
  progressCounterLabel: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '700',
  },
  progressCounterValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sessionInstructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  sessionInstructionText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
    flexDirection: 'row',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 4,
  },
  finishSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E6B3A',
    borderRadius: 14,
    paddingVertical: 13,
    gap: 8,
  },
  finishSessionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  noSessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  noSessionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  noSessionSub: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 12,
  },
  startSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 6,
  },
  startSessionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Section Header */
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  resetFilterBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  resetFilterText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
  },

  /* Mode B: Prominent Inventory Search Card */
  inventorySearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  /* Search and Filter Section */
  searchFilterSection: {
    marginBottom: 12,
  },
  prominentSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
  },
  searchIcon: {
    marginLeft: 6,
  },
  clearSearchBtn: {
    padding: 6,
  },
  prominentSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
    fontWeight: '600',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
    marginBottom: 2,
  },
  chipButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipButtonActive: {
    backgroundColor: '#1E6B3A',
    borderColor: '#1E6B3A',
  },
  chipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  inventoryHeaderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inventoryMetaCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  /* Mode A: Device Cards */
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    padding: 12,
    marginBottom: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceCardVerified: {
    borderColor: '#BBF7D0',
    backgroundColor: '#FAFCFA',
  },
  deviceRightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconBoxPending: {
    backgroundColor: '#EEF2FF',
  },
  deviceIconBoxVerified: {
    backgroundColor: '#DCFCE7',
  },
  deviceInfoColumn: {
    flex: 1,
    alignItems: 'flex-start',
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deviceTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  deviceTitleVerified: {
    color: '#15803D',
  },
  categoryBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  deviceSubtitleText: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'right',
    marginTop: 2,
    fontWeight: '500',
  },
  tsadiHighlightText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceLeftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editLocationBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  verifiedPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  /* Mode B: Clean Read-Only Inventory Card */
  inventoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  inventoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  inventoryCategoryBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inventoryCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  inventoryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  tsadiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tsadiTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  locationTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  inventoryTransferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  inventoryTransferBtnText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  inventoryEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inventoryEditBtnText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },

  /* Fault Status & Brigade Replacement Styles */
  deviceCardInspection: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
    borderWidth: 1.5,
  },
  deviceCardReplacement: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
  },
  deviceIconBoxInspection: {
    backgroundColor: '#FEF3C7',
  },
  deviceIconBoxReplacement: {
    backgroundColor: '#FEE2E2',
  },
  inventoryCardInspection: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
    borderWidth: 1.5,
  },
  inventoryCardReplacement: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
  },
  faultBadgeInspection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  faultBadgeTextInspection: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  faultBadgeReplacement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  faultBadgeTextReplacement: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
  },
  brigadeReplaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  brigadeReplaceBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  inventoryFaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inventoryFaultBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  inventoryFaultBtnText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },

  /* Footer & Empty */
  syncFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  syncFooterText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },

  /* Platoon Selector Fallback */
  platoonSelectorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  selectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },

  /* Bottom Navigation */
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
  },
  navText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  navTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
});
