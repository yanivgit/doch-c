import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SectionList, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  TextInput, 
  Platform, 
  LayoutAnimation, 
  Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { 
  getAllDevices, 
  subscribeToAllDevices, 
  Device, 
  deleteDevice, 
  VerificationSession, 
  archiveExpiredSessions, 
  resetSession, 
  getDailyDocId, 
  startGlobalSession, 
  subscribeToVerifiedDevices, 
  reopenKashpalSession, 
  resetPlatoonSession, 
  markDeviceAsFixed 
} from '../../../firebase/api';
import { db } from '../../../firebase/config';
import { onSnapshot, doc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import AddDeviceModal from '../../../components/AddDeviceModal';
import TransferDeviceModal from '../../../components/TransferDeviceModal';
import DeviceHistoryModal from '../../../components/DeviceHistoryModal';
import Snackbar from '../../../components/Snackbar';
import VerificationHistoryModal from '../../../components/VerificationHistoryModal';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import DailySummaryModal from '../../../components/DailySummaryModal';
import ReportFaultModal from '../../../components/ReportFaultModal';
import ReplaceDeviceModal from '../../../components/ReplaceDeviceModal';
import OfflineBanner from '../../../components/OfflineBanner';

export default function KashragReportScreen() {
  const router = useRouter();
  const { selectedDohId, selectedDohName, logout } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [transferDevice, setTransferDevice] = useState<Device | null>(null);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);
  const [faultModalDevice, setFaultModalDevice] = useState<Device | null>(null);
  const [isFaultModalVisible, setIsFaultModalVisible] = useState(false);
  const [replacingDevice, setReplacingDevice] = useState<Device | null>(null);
  
  // Dual-Tab state ('report' vs 'inventory')
  const [activeTab, setActiveTab] = useState<'report' | 'inventory'>('report');

  // Search & Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'platoons' | 'types'>('platoons');
  
  // Verification Session State
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [verifiedDevicesMap, setVerifiedDevicesMap] = useState<Record<string, { verifiedAt: any; verifiedBy: string }>>({});
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [auditTrailVisible, setAuditTrailVisible] = useState(false);
  const isArchivingRef = useRef(false);

  // Floating Bottom Navigation State & Animation
  const [isBarExpanded, setIsBarExpanded] = useState(true);
  const [barTranslateY] = useState(() => new Animated.Value(0));
  const [barOpacity] = useState(() => new Animated.Value(1));
  const [fabScale] = useState(() => new Animated.Value(1));

  const toggleBar = useCallback(() => {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setIsBarExpanded(prev => !prev);
  }, [fabScale]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(barTranslateY, {
        toValue: isBarExpanded ? 0 : 95,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(barOpacity, {
        toValue: isBarExpanded ? 1 : 0,
        duration: isBarExpanded ? 220 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isBarExpanded, barTranslateY, barOpacity]);

  const handleOpenTimeline = useCallback(() => {
    setAuditTrailVisible(true);
  }, []);

  const handleGoToLogin = useCallback(async () => {
    await logout();
    router.replace('/');
  }, [logout, router]);

  const fetchDevices = useCallback(async () => {
    if (!selectedDohId) return;
    try {
      const data = await getAllDevices(selectedDohId);
      setDevices(data);
    } catch (error) {
      console.error("Error fetching devices manually in Kashrag:", error);
    }
  }, [selectedDohId]);

  const handleMarkFixed = useCallback(async (device: Device) => {
    if (!device.id) return;
    try {
      await markDeviceAsFixed(device.id, 'קשר"ג');
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
  }, [fetchDevices]);

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

  const handleDelete = useCallback((id: string) => {
    const deviceToDelete = devices.find(d => d.id === id);
    const expectedTsadi = deviceToDelete ? String(deviceToDelete.tsadiNumber).trim() : '';

    if (Platform.OS === 'web') {
      const input = window.prompt(
        `אזהרה: מחיקת מכשיר היא פעולה בלתי הפיכה.\nכדי לאשר את המחיקה, הקלד את מספר הצ' המדויק של המכשיר (${expectedTsadi}):`
      );
      if (input === null) return;
      if (input.trim() !== expectedTsadi) {
        window.alert("מספר הצ' שהוקלד אינו תואם. המחיקה בוטלה.");
        return;
      }
      deleteDevice(id).then(fetchDevices);
      return;
    }

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'אישור מחיקת מכשיר',
        `אזהרה: מחיקת מכשיר היא פעולה בלתי הפיכה.\nכדי לאשר את המחיקה, הקלד את מספר הצ' המדויק (${expectedTsadi}):`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחק לצמיתות',
            style: 'destructive',
            onPress: (input?: string) => {
              if (input && input.trim() === expectedTsadi) {
                deleteDevice(id).then(fetchDevices);
              } else {
                Alert.alert('שגיאה', "מספר הצ' שהוקלד אינו תואם. המחיקה בוטלה.");
              }
            }
          }
        ],
        'plain-text',
        '',
        'numeric'
      );
      return;
    }

    Alert.alert(
      'מחיקת מכשיר',
      `האם אתה בטוח שברצונך למחוק את מכשיר צ' ${expectedTsadi} לצמיתות?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => deleteDevice(id).then(fetchDevices)
        }
      ]
    );
  }, [devices, fetchDevices]);

  // Real-time synchronization for devices
  useEffect(() => {
    if (!selectedDohId) {
      setDevices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToAllDevices(
      selectedDohId,
      (data) => {
        setDevices(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to devices in Kashrag:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedDohId]);

  // Real-time synchronization for daily verification session
  useEffect(() => {
    if (!selectedDohId) return;

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    const setupSession = async () => {
      const docId = getDailyDocId(selectedDohId);
      const sessionRef = doc(db, 'verificationSessions', docId);

      unsubscribe = onSnapshot(sessionRef, async (snap) => {
        if (!isMounted) return;
        try {
          if (!snap.exists()) {
            setActiveSession(null);
            return;
          }
          
          const sessionData = { id: snap.id, ...snap.data() } as VerificationSession;
          
          if (sessionData.globalStatus === 'archived') {
            setActiveSession(null);
          } else if (sessionData.expiresAt.toMillis() < Date.now()) {
            if (!isArchivingRef.current) {
              isArchivingRef.current = true;
              try {
                await archiveExpiredSessions(selectedDohId);
              } finally {
                isArchivingRef.current = false;
              }
            }
            setActiveSession(null);
          } else {
            setActiveSession(sessionData);
          }
        } catch (error) {
          console.error("Error processing snapshot in Kashrag:", error);
        }
      }, (error) => {
        console.error("Snapshot error in Kashrag:", error);
      });
    };

    setupSession();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedDohId]);

  // Real-time synchronization for verified devices subcollection
  useEffect(() => {
    if (!activeSession?.id) {
      setVerifiedDevicesMap({});
      return;
    }

    const unsubscribe = subscribeToVerifiedDevices(
      activeSession.id,
      (map) => {
        setVerifiedDevicesMap(map);
      },
      (error) => {
        console.error("Error subscribing to verified devices in Kashrag:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeSession?.id]);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase().trim();
    return devices.filter(d => 
      (d.tsadiNumber && d.tsadiNumber.toLowerCase().includes(q)) ||
      (d.type && d.type.toLowerCase().includes(q)) ||
      (d.assignment && d.assignment.toLowerCase().includes(q)) ||
      (d.location && d.location.toLowerCase().includes(q))
    );
  }, [devices, searchQuery]);

  const groupedDevices = useMemo(() => {
    return filteredDevices.reduce((acc, device) => {
      const key = groupBy === 'platoons' 
        ? (device.assignment || 'ללא שיוך') 
        : (device.type || 'אחר');
        
      if (!acc[key]) acc[key] = [];
      acc[key].push(device);
      return acc;
    }, {} as Record<string, Device[]>);
  }, [filteredDevices, groupBy]);

  const groupKeys = useMemo(() => Object.keys(groupedDevices).sort(), [groupedDevices]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const sections = useMemo(() => {
    const isSearching = searchQuery.trim().length > 0;
    return groupKeys.map(key => {
      const items = groupedDevices[key] || [];
      const isExpanded = isSearching || expandedSections.has(key);
      return {
        title: key,
        summary: `${items.length} פריטים`,
        isExpanded,
        data: isExpanded ? items : [],
      };
    });
  }, [groupKeys, groupedDevices, expandedSections, searchQuery]);

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

  const platoonStats = useMemo(() => {
    if (!activeSession) return { platoons: [], platoonTotals: {}, platoonVerified: {} };
    
    const totals: Record<string, number> = {};
    const verifiedStats: Record<string, number> = {};
    
    devices.forEach(d => {
      const p = d.assignment || 'ללא שיוך';
      totals[p] = (totals[p] || 0) + 1;
      
      if (d.id && (verifiedDevicesMap[d.id] || activeSession.verifiedDevices?.[d.id])) {
        verifiedStats[p] = (verifiedStats[p] || 0) + 1;
      }
    });

    return {
      platoons: Object.keys(totals).sort(),
      platoonTotals: totals,
      platoonVerified: verifiedStats
    };
  }, [devices, activeSession, verifiedDevicesMap]);

  const handleReopenPlatoon = useCallback(async (platoonName: string) => {
    if (!selectedDohId) return;
    try {
      setLoading(true);
      await reopenKashpalSession(selectedDohId, platoonName);
      if (Platform.OS === 'web') {
        window.alert(`דו"ח ${platoonName} נפתח מחדש בהצלחה להמשך אימות.`);
      } else {
        Alert.alert('הצלחה', `דו"ח ${platoonName} נפתח מחדש בהצלחה להמשך אימות.`);
      }
    } catch (err) {
      console.error("Error reopening platoon:", err);
      Alert.alert('שגיאה', 'לא ניתן לפתוח מחדש את הפלוגה.');
    } finally {
      setLoading(false);
    }
  }, [selectedDohId]);

  const handleResetPlatoon = useCallback(async (platoonName: string) => {
    if (!selectedDohId) return;
    try {
      setLoading(true);
      await resetPlatoonSession(selectedDohId, platoonName);
      if (Platform.OS === 'web') {
        window.alert(`נתוני ${platoonName} אופסו בהצלחה. הפלוגה חזרה למצב 'ממתין' (0%).`);
      } else {
        Alert.alert('הצלחה', `נתוני ${platoonName} אופסו בהצלחה. הפלוגה חזרה למצב 'ממתין' (0%).`);
      }
    } catch (err) {
      console.error("Error resetting platoon:", err);
      Alert.alert('שגיאה', 'לא ניתן לאפס את הפלוגה.');
    } finally {
      setLoading(false);
    }
  }, [selectedDohId]);

  const confirmResetPlatoon = useCallback((platoonName: string) => {
    const message = `האם אתה בטוח שברצונך לאפס את נתוני האימות של ${platoonName}?\nכל פריטי ${platoonName} יחזרו למצב 'ממתין' (0%), ושאר הפלוגות יישארו ללא שינוי.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        handleResetPlatoon(platoonName);
      }
      return;
    }
    Alert.alert(
      `איפוס נתוני ${platoonName}`,
      message,
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'אפס פלוגה', 
          style: 'destructive',
          onPress: () => handleResetPlatoon(platoonName) 
        }
      ]
    );
  }, [handleResetPlatoon]);

  const handleStartSession = async () => {
    if (!selectedDohId) return;
    try {
      const allPlatoons = Object.keys(platoonStats.platoonTotals);
      await startGlobalSession(selectedDohId, allPlatoons);
      Alert.alert('הצלחה', 'הדו"ח היומי הופעל בהצלחה לכל הפלוגות!');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן ליצור דו"ח חדש');
    }
  };

  const handleCopyReport = async () => {
    const platoonGroups: Record<string, Device[]> = {};
    devices.forEach(device => {
      const p = device.assignment || 'ללא שיוך';
      if (!platoonGroups[p]) platoonGroups[p] = [];
      platoonGroups[p].push(device);
    });

    let reportText = '';
    const sortedPlatoons = Object.keys(platoonGroups).sort();
    
    sortedPlatoons.forEach((platoon) => {
      reportText += `${platoon} :\n`;
      const pDevices = platoonGroups[platoon];
      pDevices.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
      pDevices.forEach(d => {
        const locationPart = d.location ? ` (${d.location})` : '';
        reportText += `${d.type || 'אחר'} - ${d.tsadiNumber || 'ללא צ'}${locationPart}\n`;
      });
      reportText += '\n';
    });

    try {
      await Clipboard.setStringAsync(reportText.trimEnd());
      setSnackbarVisible(true);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להעתיק את הדו"ח ללוח.');
    }
  };

  const totalBattalionVerified = useMemo(() => {
    return Object.values(platoonStats.platoonVerified).reduce((a, b) => a + b, 0);
  }, [platoonStats]);

  const totalBattalionDevices = devices.length;
  const overallPercentage = totalBattalionDevices > 0 ? (totalBattalionVerified / totalBattalionDevices) * 100 : 0;

  // Platoon status list inside Tab 1 (דו"ח)
  const renderStatusBars = () => {
    if (!activeSession) return null;
    const { platoons, platoonTotals, platoonVerified } = platoonStats;

    return (
      <View style={styles.platoonsGrid}>
        {platoons.map(p => {
          const total = platoonTotals[p];
          const verified = platoonVerified[p] || 0;
          const percentage = total > 0 ? (verified / total) * 100 : 0;
          const platoonData = activeSession.platoons?.[p];
          const isStarted = !!platoonData;
          const isCompleted = platoonData?.status === 'completed';
          const isFullyVerified = isCompleted && verified === total && total > 0;
          const isCompletedWithMissing = isCompleted && verified < total;

          return (
            <View key={p} style={styles.platoonCard}>
              <View style={styles.platoonCardTop}>
                <View style={styles.platoonNameGroup}>
                  <Text style={styles.platoonNameText}>{p}</Text>
                  {isFullyVerified ? (
                    <View style={styles.statusPillGreen}>
                      <Feather name="check-circle" size={12} color="#15803D" />
                      <Text style={styles.statusPillTextGreen}>100% אומת</Text>
                    </View>
                  ) : isCompletedWithMissing ? (
                    <View style={styles.statusPillAmber}>
                      <Feather name="alert-triangle" size={12} color="#B45309" />
                      <Text style={styles.statusPillTextAmber}>הושלם חלקית</Text>
                    </View>
                  ) : isStarted ? (
                    <View style={styles.statusPillBlue}>
                      <Feather name="clock" size={12} color="#2563EB" />
                      <Text style={styles.statusPillTextBlue}>בביצוע בשטח</Text>
                    </View>
                  ) : (
                    <View style={styles.statusPillSlate}>
                      <Text style={styles.statusPillTextSlate}>ממתין</Text>
                    </View>
                  )}
                </View>

                <View style={styles.platoonStatsGroup}>
                  <Text style={styles.platoonCountText}>
                    {verified} <Text style={{ color: '#94A3B8' }}>/ {total}</Text>
                  </Text>
                  <Text style={styles.platoonPercentText}>{Math.round(percentage)}%</Text>
                  {isStarted && (
                    <TouchableOpacity
                      style={styles.miniResetBtn}
                      onPress={() => confirmResetPlatoon(p)}
                      activeOpacity={0.7}
                      accessibilityLabel={`אפס נתוני ${p}`}
                    >
                      <Feather name="refresh-ccw" size={12} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Progress Track */}
              <View style={styles.progressTrack}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${percentage}%`,
                      backgroundColor: isFullyVerified 
                        ? '#15803D' 
                        : (isCompletedWithMissing ? '#D97706' : (isStarted ? '#2563EB' : '#CBD5E1'))
                    }
                  ]} 
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderSectionHeader = useCallback(({ section }: { section: { title: string; summary: string; isExpanded: boolean } }) => {
    return (
      <View style={styles.accordionHeaderContainer}>
        <TouchableOpacity 
          style={styles.accordionHeader} 
          onPress={() => toggleSection(section.title)} 
          activeOpacity={0.8}
        >
          <View style={styles.accordionHeaderContent}>
            <Text style={styles.accordionTitle}>{section.title}</Text>
            {section.summary ? (
              <View style={styles.accordionCountBadge}>
                <Text style={styles.accordionCountText}>{section.summary}</Text>
              </View>
            ) : null}
          </View>
          <Feather 
            name={section.isExpanded ? "chevron-up" : "chevron-down"} 
            size={18} 
            color="#64748B" 
          />
        </TouchableOpacity>
      </View>
    );
  }, [toggleSection]);

  const renderDeviceItem = useCallback(({ item: device }: { item: Device }) => {
    const fault = device.faultStatus;

    return (
      <View 
        style={[
          styles.deviceCard,
          fault === 'inspection' && styles.deviceCardInspection,
          fault === 'replacement' && styles.deviceCardReplacement
        ]}
      >
        <View style={styles.deviceCardHeader}>
          <View style={styles.deviceInfoGroup}>
            <View style={styles.deviceTitleRow}>
              <View style={styles.tsadiBadge}>
                <Text style={styles.tsadiText}>צ׳ {device.tsadiNumber}</Text>
              </View>
              <Text style={styles.deviceType}>{device.type}</Text>
            </View>

            <View style={styles.deviceMetaRow}>
              <View style={styles.metaTag}>
                <Feather name="shield" size={11} color="#64748B" />
                <Text style={styles.metaTagText}>{device.assignment || 'ללא שיוך'}</Text>
              </View>
              {device.location ? (
                <View style={styles.metaTag}>
                  <Feather name="map-pin" size={11} color="#0284C7" />
                  <Text style={[styles.metaTagText, { color: '#0284C7' }]}>{device.location}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Fault Banner Pills */}
          {fault && (
            <View style={styles.faultHeaderPill}>
              {fault === 'inspection' && (
                <View style={styles.badgeInspection}>
                  <Feather name="alert-circle" size={11} color="#B45309" />
                  <Text style={styles.badgeInspectionText}>דרושה בדיקת קשר</Text>
                </View>
              )}
              {fault === 'replacement' && (
                <View style={styles.badgeReplacement}>
                  <Feather name="alert-octagon" size={11} color="#B91C1C" />
                  <Text style={styles.badgeReplacementText}>דורש החלפה</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action Button Strip */}
        <View style={styles.deviceActionsStrip}>
          {fault === 'replacement' && (
            <TouchableOpacity 
              style={[styles.actionBtnIcon, styles.actionBtnIconRed]} 
              onPress={() => setReplacingDevice(device)}
              accessibilityLabel="החלפה מול חטיבה"
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={14} color="#DC2626" />
              <Text style={[styles.actionBtnIconText, { color: '#DC2626' }]}>החלף בחטיבה</Text>
            </TouchableOpacity>
          )}

          {fault && (
            <TouchableOpacity 
              style={[styles.actionBtnIcon, styles.actionBtnIconGreen]} 
              onPress={() => confirmMarkFixed(device)}
              accessibilityLabel="סמן כתוקן"
              activeOpacity={0.8}
            >
              <Feather name="check" size={14} color="#15803D" />
              <Text style={[styles.actionBtnIconText, { color: '#15803D' }]}>תוקן</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.actionBtnIcon} 
            onPress={() => {
              setFaultModalDevice(device);
              setIsFaultModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Feather 
              name="alert-triangle" 
              size={14} 
              color={fault ? '#DC2626' : '#64748B'} 
            />
            <Text style={styles.actionBtnIconText}>{fault ? 'עדכן תקלה' : 'דווח תקלה'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtnIcon} 
            onPress={() => setTransferDevice(device)}
            activeOpacity={0.8}
          >
            <Feather name="repeat" size={14} color="#0F172A" />
            <Text style={styles.actionBtnIconText}>העבר פלוגה</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtnIcon} 
            onPress={() => setHistoryDevice(device)}
            activeOpacity={0.8}
          >
            <Feather name="clock" size={14} color="#0F172A" />
            <Text style={styles.actionBtnIconText}>היסטוריה</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtnIcon, styles.actionBtnIconDanger]} 
            onPress={() => device.id && handleDelete(device.id)}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [confirmMarkFixed, handleDelete]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <OfflineBanner />

      {/* 1. Tactical Command Header */}
      <View style={styles.commandHeader}>
        <View style={styles.headerRightBlock}>
          <View style={styles.unitBadge}>
            <MaterialIcons name="shield" size={15} color="#15803D" />
            <Text style={styles.unitBadgeText}>
              {`דו"ח ציוד טקטי • מחזור א׳${selectedDohName && !selectedDohName.includes('מחזור א') ? ` (${selectedDohName})` : ''}`}
            </Text>
          </View>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>ניהול ציוד ודיווח (קשר"ג)</Text>
            <View style={styles.commandCenterBadge}>
              <Text style={styles.commandCenterText}>Command Center</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerLeftBlock}>
          <TouchableOpacity 
            style={styles.headerActionBtn} 
            onPress={handleCopyReport}
            activeOpacity={0.8}
            accessibilityLabel="העתק דו״ח"
          >
            <Feather name="copy" size={15} color="#0F172A" />
            <Text style={styles.headerActionBtnText}>העתק דו"ח</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.logoutBtn} 
            onPress={handleLogout}
            activeOpacity={0.8}
            accessibilityLabel="התנתק"
          >
            <Feather name="log-out" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Tactical Dual-Tab Segmented Switcher */}
      <View style={styles.tabSwitcherContainer}>
        <View style={styles.tabSwitcher}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'report' && styles.tabButtonActive]}
            onPress={() => setActiveTab('report')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons 
              name="clipboard-check-outline" 
              size={18} 
              color={activeTab === 'report' ? '#15803D' : '#64748B'} 
              style={{ marginLeft: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
              דו"ח
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'inventory' && styles.tabButtonActive]}
            onPress={() => setActiveTab('inventory')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons 
              name="format-list-bulleted" 
              size={18} 
              color={activeTab === 'inventory' ? '#15803D' : '#64748B'} 
              style={{ marginLeft: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>
              רשימת ציוד
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Main Content Views */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#15803D" />
            <Text style={styles.loadingText}>טוען נתוני גדוד...</Text>
          </View>
        ) : activeTab === 'report' ? (
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Battalion Operational Status Console */}
            {activeSession && activeSession.globalStatus !== 'pending' && activeSession.globalStatus !== 'archived' ? (
              <View style={styles.activeSessionBanner}>
                <View style={styles.sessionBannerTop}>
                  <View style={styles.beaconGroup}>
                    <View style={styles.beaconDot} />
                    <Text style={styles.beaconTitle}>סבב יומי פעיל בגדוד</Text>
                  </View>
                  <View style={styles.sessionProgressStats}>
                    <Text style={styles.sessionCountText}>
                      {totalBattalionVerified} / {totalBattalionDevices}
                    </Text>
                    <Text style={styles.sessionPercentText}>
                      ({Math.round(overallPercentage)}%)
                    </Text>
                  </View>
                </View>

                {/* Overall Progress Gauge */}
                <View style={styles.overallProgressTrack}>
                  <View style={[styles.overallProgressFill, { width: `${overallPercentage}%` }]} />
                </View>

                {/* Platoons Breakdown Grid */}
                <Text style={styles.sectionHeaderTitle}>התקדמות אימות לפי פלוגות:</Text>
                {renderStatusBars()}

                {activeSession.globalStatus !== 'active' && (
                  <View style={styles.sessionActionRow}>
                    <TouchableOpacity 
                      style={styles.startSessionBtn} 
                      onPress={handleStartSession}
                      activeOpacity={0.85}
                    >
                      <Feather name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.startSessionBtnText}>הפעל דו"ח לכל הפלוגות</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.historyBtn} 
                      onPress={() => setHistoryModalVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Feather name="clock" size={16} color="#0F172A" />
                      <Text style={styles.historyBtnText}>היסטוריה</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.idleSessionCard}>
                <View style={styles.idleIconCircle}>
                  <MaterialCommunityIcons name="clock-start" size={32} color="#15803D" />
                </View>
                <Text style={styles.idleTitle}>אין דו״ח יומי פעיל כרגע</Text>
                <Text style={styles.idleSub}>
                  הפעל סבב יומי מרוכז כדי לאפשר לפלוגות בשטח להתחיל באימות הציוד
                </Text>
                <View style={styles.idleActionsRow}>
                  <TouchableOpacity 
                    style={styles.startSessionBtn} 
                    onPress={handleStartSession}
                    activeOpacity={0.85}
                  >
                    <Feather name="play" size={16} color="#FFFFFF" />
                    <Text style={styles.startSessionBtnText}>פתח דו"ח יומי</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.historyBtn} 
                    onPress={() => setHistoryModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Feather name="clock" size={16} color="#0F172A" />
                    <Text style={styles.historyBtnText}>היסטוריית דוחות</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Inventory Tab: Search, Grouping and Accordion SectionList */
          <SectionList
            style={styles.scrollContainer}
            contentContainerStyle={styles.inventoryListContent}
            keyboardShouldPersistTaps="handled"
            sections={sections}
            keyExtractor={(item) => item.id || item.tsadiNumber}
            renderItem={renderDeviceItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            ListHeaderComponent={
              <View style={styles.controlsCard}>
                <View style={styles.searchBar}>
                  <Feather name="search" size={18} color="#64748B" />
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="חיפוש לפי צ' או סוג..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                      <Feather name="x" size={16} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.groupingToggle}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, groupBy === 'types' && styles.toggleBtnActive]}
                    onPress={() => setGroupBy('types')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.toggleBtnText, groupBy === 'types' && styles.toggleBtnTextActive]}>
                      לפי סוג מכשיר
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, groupBy === 'platoons' && styles.toggleBtnActive]}
                    onPress={() => setGroupBy('platoons')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.toggleBtnText, groupBy === 'platoons' && styles.toggleBtnTextActive]}>
                      לפי פלוגות
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyInventoryCard}>
                <Feather name="inbox" size={36} color="#CBD5E1" />
                <Text style={styles.emptyInventoryText}>לא נמצא ציוד התואם את החיפוש.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modals & Dialogs */}
      <AddDeviceModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        onAdded={fetchDevices} 
      />

      <TransferDeviceModal
        device={transferDevice}
        visible={!!transferDevice}
        onClose={() => setTransferDevice(null)}
        onTransfer={fetchDevices}
      />
      
      <DeviceHistoryModal
        device={historyDevice}
        visible={!!historyDevice}
        onClose={() => setHistoryDevice(null)}
      />
      
      <VerificationHistoryModal 
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        dohId={selectedDohId || ''}
      />

      <DailySummaryModal
        visible={auditTrailVisible}
        onClose={() => setAuditTrailVisible(false)}
        dohId={selectedDohId || ''}
      />

      <ReportFaultModal
        visible={isFaultModalVisible}
        initialDevice={faultModalDevice}
        onClose={() => {
          setIsFaultModalVisible(false);
          setFaultModalDevice(null);
        }}
        onSuccess={fetchDevices}
      />

      <ReplaceDeviceModal
        visible={!!replacingDevice}
        device={replacingDevice}
        onClose={() => setReplacingDevice(null)}
        onReplaced={fetchDevices}
      />

      <Snackbar 
        visible={snackbarVisible} 
        message="הדו״ח הועתק ללוח בהצלחה!" 
        onDismiss={() => setSnackbarVisible(false)} 
      />

      {/* 4. Floating Tactical Bottom Navigation Dock */}
      <View style={styles.floatingBarWrapper} pointerEvents="box-none">
        <Animated.View 
          style={[
            styles.floatingBar,
            {
              transform: [{ translateY: barTranslateY }],
              opacity: barOpacity,
            },
          ]}
          pointerEvents={isBarExpanded ? 'auto' : 'none'}
        >
          {/* 1. היסטוריה דו"ח צ' */}
          <TouchableOpacity 
            style={styles.floatingNavItem} 
            onPress={() => setHistoryModalVisible(true)}
            activeOpacity={0.7}
          >
            <Feather name="archive" size={20} color="#475569" />
            <Text style={styles.floatingNavText}>היסטוריה</Text>
          </TouchableOpacity>

          {/* 2. יומן אירועים */}
          <TouchableOpacity 
            style={styles.floatingNavItem} 
            onPress={handleOpenTimeline}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="history" size={22} color="#475569" />
            <Text style={styles.floatingNavText}>יומן אירועים</Text>
          </TouchableOpacity>

          {/* Center Space Placeholder for FAB */}
          <View style={styles.centerButtonPlaceholder} />

          {/* 3. קשר"ג (Active Role) */}
          <TouchableOpacity 
            style={styles.floatingNavItem} 
            activeOpacity={0.8}
          >
            <MaterialIcons name="military-tech" size={24} color="#15803D" />
            <Text style={[styles.floatingNavText, styles.floatingNavTextActive]}>קשר"ג</Text>
          </TouchableOpacity>

          {/* 4. כניסה (Log Out / Return to Entry) */}
          <TouchableOpacity 
            style={styles.floatingNavItem} 
            onPress={handleGoToLogin}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="badge-account-horizontal-outline" size={22} color="#475569" />
            <Text style={styles.floatingNavText}>כניסה</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Center Green FAB Button */}
        <Animated.View 
          style={[
            styles.centerFabAnchor,
            { transform: [{ scale: fabScale }] }
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            testID="center-plus-toggle"
            accessibilityLabel="הוסף ציוד"
            style={styles.centerFabRing}
            onPress={() => setModalVisible(true)}
            onLongPress={toggleBar}
            activeOpacity={0.85}
          >
            <View style={styles.centerFabInner}>
              <Feather name="plus" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* 1. Command Header */
  commandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRightBlock: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  commandCenterBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E0E7FE',
  },
  commandCenterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.3,
  },
  headerLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
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
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 2. Dual-Tab Segmented Switcher */
  tabSwitcherContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  /* Content Scroll & Lists */
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 130,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  inventoryListContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 130,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  /* Active Session Banner */
  activeSessionBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  sessionBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  beaconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beaconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#15803D',
  },
  beaconTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sessionProgressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionCountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sessionPercentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  overallProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 4,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    textAlign: 'right',
  },

  /* Platoons Breakdown Grid */
  platoonsGrid: {
    gap: 10,
  },
  platoonCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  platoonCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  platoonNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platoonNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPillTextGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  statusPillAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPillTextAmber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  statusPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  statusPillTextBlue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  statusPillSlate: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillTextSlate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  platoonStatsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platoonCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  platoonPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  miniResetBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  sessionActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  startSessionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  startSessionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  historyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Idle Session Card */
  idleSessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  idleIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  idleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  idleSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 320,
  },
  idleActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 340,
  },

  /* Inventory Controls (Search & Grouping) */
  controlsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'right',
  },
  clearSearchBtn: {
    padding: 4,
  },
  groupingToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  /* Accordion Headers */
  accordionHeaderContainer: {
    marginTop: 8,
    marginBottom: 6,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accordionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  accordionCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accordionCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Device Card */
  deviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  deviceCardInspection: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  deviceCardReplacement: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  deviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  deviceInfoGroup: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 6,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tsadiBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tsadiText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deviceType: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  faultHeaderPill: {
    marginLeft: 6,
  },
  badgeInspection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeInspectionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  badgeReplacement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeReplacementText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Action Buttons Strip */
  deviceActionsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtnIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
  },
  actionBtnIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  actionBtnIconGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  actionBtnIconRed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  actionBtnIconDanger: {
    paddingHorizontal: 8,
  },

  emptyInventoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyInventoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  /* Floating Bottom Navigation Dock */
  floatingBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatingBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 24 : 14,
    width: '92%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 56,
  },
  floatingNavText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  floatingNavTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
  centerButtonPlaceholder: {
    width: 54,
  },

  /* Floating Center Button */
  centerFabAnchor: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 32,
    alignSelf: 'center',
    zIndex: 10,
  },
  centerFabRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  centerFabInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
