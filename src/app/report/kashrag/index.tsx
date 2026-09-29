import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { getAllDevices, subscribeToAllDevices, Device, deleteDevice, VerificationSession, archiveSession, archiveExpiredSessions, resetSession, getDailyDocId, startGlobalSession, subscribeToVerifiedDevices, reopenKashpalSession, resetPlatoonSession } from '../../../firebase/api';
import { db } from '../../../firebase/config';
import { onSnapshot, doc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import AddDeviceModal from '../../../components/AddDeviceModal';
import TransferDeviceModal from '../../../components/TransferDeviceModal';
import DeviceHistoryModal from '../../../components/DeviceHistoryModal';
import Snackbar from '../../../components/Snackbar';
import { theme } from '../../../theme/theme';
import VerificationHistoryModal from '../../../components/VerificationHistoryModal';
import { Feather } from '@expo/vector-icons';
import DailySummaryModal from '../../../components/DailySummaryModal';
import ReportFaultModal from '../../../components/ReportFaultModal';
import ReplaceDeviceModal from '../../../components/ReplaceDeviceModal';
import OfflineBanner from '../../../components/OfflineBanner';

export default function KashragReportScreen() {
  const { selectedDohId, selectedDohName, logout } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [transferDevice, setTransferDevice] = useState<Device | null>(null);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);
  const [faultModalDevice, setFaultModalDevice] = useState<Device | null>(null);
  const [isFaultModalVisible, setIsFaultModalVisible] = useState(false);
  const [replacingDevice, setReplacingDevice] = useState<Device | null>(null);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'platoons' | 'types'>('platoons');
  
  // Verification Session State
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [verifiedDevicesMap, setVerifiedDevicesMap] = useState<Record<string, { verifiedAt: any; verifiedBy: string }>>({});
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [auditTrailVisible, setAuditTrailVisible] = useState(false);
  const isArchivingRef = useRef(false);

  const fetchDevices = useCallback(async () => {
    if (!selectedDohId) return;
    try {
      const data = await getAllDevices(selectedDohId);
      setDevices(data);
    } catch (error) {
      console.error("Error fetching devices manually in Kashrag:", error);
    }
  }, [selectedDohId]);

  // Real-time synchronization for all devices matching current dohId
  useEffect(() => {
    if (!selectedDohId) {
      setDevices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToAllDevices(
      selectedDohId,
      (liveDevices) => {
        setDevices(liveDevices);
        setLoading(false);
      },
      (error) => {
        console.error("Error in Kashrag live devices subscription:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedDohId]);

  // Real-time synchronization with active verification session & sweeper for expired sessions
  useEffect(() => {
    if (!selectedDohId) return;

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupSession = async () => {
      // 1. Run sweeper for expired sessions BEFORE generating today's getDailyDocId
      try {
        await archiveExpiredSessions(selectedDohId);
      } catch (err) {
        console.error("Error running archiveExpiredSessions sweeper:", err);
      }

      if (!isMounted) return;

      // 2. Generate today's getDailyDocId and subscribe to live session
      const docId = getDailyDocId(selectedDohId);
      const docRef = doc(db, 'verificationSessions', docId);

      unsubscribe = onSnapshot(docRef, async (snap) => {
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
                const currentDevices = await getAllDevices(selectedDohId);
                await archiveSession(sessionData, currentDevices, {
                  autoArchivedIncomplete: true,
                  completionNotes: 'אורכב אוטומטית בחצות - הדו"ח לא הושלם במלואו'
                });
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
        Alert.alert('שגיאה', 'אבד החיבור לשרת. מנסה להתחבר מחדש...');
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

  const handleDelete = async (deviceId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('האם אתה בטוח שברצונך למחוק ציוד זה מהמערכת? פעולה זו בלתי הפיכה.');
      if (confirmed) {
        try {
          await deleteDevice(deviceId);
          fetchDevices();
        } catch {
          window.alert('לא ניתן למחוק את הציוד');
        }
      }
      return;
    }

    Alert.alert(
      'מחיקת ציוד',
      'האם אתה בטוח שברצונך למחוק ציוד זה מהמערכת? פעולה זו בלתי הפיכה.',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'מחק', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDevice(deviceId);
              fetchDevices();
            } catch {
              Alert.alert('שגיאה', 'לא ניתן למחוק את הציוד');
            }
          }
        }
      ]
    );
  };

  // 1. Filter devices based on search query
  const filteredDevices = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return devices.filter(device => 
      device.tsadiNumber.includes(lowerQuery) || 
      device.type.toLowerCase().includes(lowerQuery) ||
      (device.assignment || '').toLowerCase().includes(lowerQuery)
    );
  }, [devices, searchQuery]);

  // 2. Group devices based on selected toggle
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
      if (Platform.OS === 'web') {
        window.alert('לא ניתן לפתוח מחדש את הפלוגה.');
      } else {
        Alert.alert('שגיאה', 'לא ניתן לפתוח מחדש את הפלוגה.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDohId]);

  const confirmReopenPlatoon = useCallback((platoonName: string) => {
    const message = `האם לפתוח מחדש את דו"ח ${platoonName} עבור הקשפ"ל? הקשפ"ל יוכל להמשיך לספור ולאמת פריטים נוספים.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        handleReopenPlatoon(platoonName);
      }
      return;
    }
    Alert.alert(
      'פתיחה מחדש של פלוגה',
      message,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'פתח מחדש', onPress: () => handleReopenPlatoon(platoonName) }
      ]
    );
  }, [handleReopenPlatoon]);

  const handleResetPlatoon = useCallback(async (platoonName: string) => {
    if (!selectedDohId) return;
    try {
      setLoading(true);
      await resetPlatoonSession(selectedDohId, platoonName);
      if (Platform.OS === 'web') {
        window.alert(`נתוני ${platoonName} אופסו בהצלחה ל-0%.`);
      } else {
        Alert.alert('הצלחה', `נתוני ${platoonName} אופסו בהצלחה ל-0%.`);
      }
    } catch (err) {
      console.error("Error resetting platoon:", err);
      if (Platform.OS === 'web') {
        window.alert('לא ניתן לאפס את הפלוגה.');
      } else {
        Alert.alert('שגיאה', 'לא ניתן לאפס את הפלוגה.');
      }
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

  const handleEndSession = async () => {
    if (!activeSession) return;
    
    const { platoons, platoonTotals, platoonVerified } = platoonStats;
    const totalBattalionDevices = devices.length;
    const verifiedBattalionDevices = Object.values(platoonVerified).reduce((a, b) => a + b, 0);
    const missingBattalionDevices = Math.max(0, totalBattalionDevices - verifiedBattalionDevices);

    const openPlatoons: string[] = [];
    const missingPlatoons: string[] = [];

    platoons.forEach(p => {
      const pData = activeSession.platoons?.[p];
      const pTotal = platoonTotals[p] || 0;
      const pVer = platoonVerified[p] || 0;
      if (!pData || pData.status !== 'completed') {
        openPlatoons.push(`${p} (טרם סיימה - ${pVer}/${pTotal})`);
      } else if (pVer < pTotal) {
        missingPlatoons.push(`${p} (${pTotal - pVer} חסרים)`);
      }
    });

    const isAllComplete = missingBattalionDevices === 0 && openPlatoons.length === 0;

    let confirmTitle = 'סיום דו"ח גדודי מושלם ✅';
    let confirmMessage = `כל ${totalBattalionDevices} הפריטים בכל הפלוגות אומתו בהצלחה!\nהאם לנעול ולארכב את הדו"ח בהיסטוריה?`;

    if (!isAllComplete) {
      confirmTitle = '⚠️ אזהרה: הדו"ח הגדודי אינו שלם!';
      confirmMessage = `שים לב: אומתו ${verifiedBattalionDevices} מתוך ${totalBattalionDevices} פריטים בגדוד.\n`;
      if (missingBattalionDevices > 0) {
        confirmMessage += `נותרו ${missingBattalionDevices} פריטים שלא אומתו!\n\n`;
      }
      if (openPlatoons.length > 0) {
        confirmMessage += `פלוגות שטרם סיימו:\n• ${openPlatoons.join('\n• ')}\n\n`;
      }
      if (missingPlatoons.length > 0) {
        confirmMessage += `פלוגות שסיימו עם חוסרים:\n• ${missingPlatoons.join('\n• ')}\n\n`;
      }
      confirmMessage += 'נעילת הדו"ח כעת תארכב את הנתונים כדו"ח עם חוסרים בהיסטוריה.\nהאם ברצונך לסיים ולנעול בכל זאת?';
    }

    const processEndSession = async () => {
      setLoading(true);
      try {
        const currentDevices = await getAllDevices(selectedDohId as string);
        await archiveSession(activeSession, currentDevices, isAllComplete ? undefined : {
          autoArchivedIncomplete: false,
          completionNotes: `הסתיים עם חוסרים ע"י קשר"ג (${missingBattalionDevices} פריטים לא אומתו)`
        });
      } catch (err) {
        console.error("Error archiving session:", err);
        Alert.alert('שגיאה', 'לא ניתן לנעול את הדו"ח. אנא נסה שוב.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`${confirmTitle}\n\n${confirmMessage}`)) {
        await processEndSession();
      }
      return;
    }

    Alert.alert(
      confirmTitle, 
      confirmMessage, 
      [
        { text: isAllComplete ? 'ביטול' : 'המשך מסדר', style: 'cancel' },
        { 
          text: isAllComplete ? 'סיים ושמור' : 'נעל עם חוסרים', 
          style: isAllComplete ? 'default' : 'destructive', 
          onPress: processEndSession 
        }
      ]
    );
  };

  const handleResetSession = async () => {
    if (!activeSession || !activeSession.id) return;
    
    const confirmMessage = 'האם אתה בטוח שברצונך לאפס את הדו"ח? כל הנתונים של הדו"ח הנוכחי יימחקו והפלוגות יצטרכו להתחיל מחדש (0%).';
    const processResetSession = async () => {
      setLoading(true);
      await resetSession(activeSession.id as string);
      setLoading(false);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await processResetSession();
      }
      return;
    }

    Alert.alert('איפוס דו"ח', confirmMessage, [
      { text: 'חזור', style: 'cancel' },
      { text: 'אפס דו"ח', style: 'destructive', onPress: processResetSession }
    ]);
  };

  const handleCopyReport = async () => {
    // Generate text grouped by platoon
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
      // Sort by Equipment Type within platoon
      pDevices.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
      
      pDevices.forEach(d => {
        const locationPart = d.location ? ` (${d.location})` : '';
        reportText += `${d.type || 'אחר'} - ${d.tsadiNumber || 'ללא צ'}${locationPart}\n`;
      });
      reportText += '\n'; // Empty line between platoons
    });

    try {
      await Clipboard.setStringAsync(reportText.trimEnd());
      setSnackbarVisible(true);
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו להעתיק את הדו"ח ללוח.');
    }
  };

  const renderStatusBars = () => {
    if (!activeSession) return null;
    
    const { platoons, platoonTotals, platoonVerified } = platoonStats;

    return (
      <View style={styles.progressContainer}>
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
            <View key={p} style={styles.progressBarRow}>
              <Text style={styles.progressLabel}>
                {p} 
                {isFullyVerified ? ' ✅' : (isCompletedWithMissing ? ' ⚠️' : (isStarted ? ' 🔄' : ''))}
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[
                  styles.progressBarFill, 
                  { 
                    width: `${percentage}%`,
                    backgroundColor: isFullyVerified 
                      ? theme.colors.success 
                      : (isCompletedWithMissing ? '#D97706' : theme.colors.primary)
                  }
                ]} />
              </View>
              <Text style={styles.progressText}>{verified}/{total}</Text>
              {isStarted && (
                <TouchableOpacity
                  style={styles.miniResetBtn}
                  onPress={() => confirmResetPlatoon(p)}
                  activeOpacity={0.7}
                  accessibilityLabel={`אפס נתוני ${p}`}
                >
                  <Feather name="refresh-ccw" size={11} color={theme.colors.danger} />
                </TouchableOpacity>
              )}
              {isCompleted && (
                <TouchableOpacity
                  style={styles.miniReopenBtn}
                  onPress={() => confirmReopenPlatoon(p)}
                  activeOpacity={0.7}
                >
                  <Feather name="unlock" size={12} color="#D97706" />
                  <Text style={styles.miniReopenText}>פתח</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderSectionHeader = useCallback(({ section }: { section: { title: string; summary: string; isExpanded: boolean } }) => {
    const isPlatoonGroup = groupBy === 'platoons';
    const platoonData = isPlatoonGroup && activeSession?.platoons ? activeSession.platoons[section.title] : null;
    const isStarted = !!platoonData;
    const isCompleted = platoonData?.status === 'completed';

    return (
      <View style={styles.accordionHeaderContainer}>
        <TouchableOpacity 
          style={styles.accordionHeader} 
          onPress={() => toggleSection(section.title)} 
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.accordionTitle}>{section.title}</Text>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>ננעל ע&quot;י קשפ&quot;ל</Text>
                </View>
              )}
            </View>
            {section.summary ? <Text style={styles.accordionSummary}>{section.summary}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {isPlatoonGroup && isStarted && (
              <TouchableOpacity
                style={styles.resetPlatoonButton}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  confirmResetPlatoon(section.title);
                }}
                activeOpacity={0.8}
              >
                <Feather name="refresh-ccw" size={12} color={theme.colors.danger} />
                <Text style={styles.resetPlatoonButtonText}>אפס</Text>
              </TouchableOpacity>
            )}
            {isCompleted && (
              <TouchableOpacity
                style={styles.reopenButton}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  confirmReopenPlatoon(section.title);
                }}
                activeOpacity={0.8}
              >
                <Feather name="unlock" size={13} color="#D97706" />
                <Text style={styles.reopenButtonText}>פתח מחדש</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.accordionIcon}>{section.isExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [toggleSection, groupBy, activeSession, confirmReopenPlatoon, confirmResetPlatoon]);

  const renderDeviceItem = useCallback(({ item: device }: { item: Device }) => {
    const fault = device.faultStatus;
    return (
      <View 
        style={[
          styles.deviceRow,
          fault === 'inspection' && styles.deviceRowInspection,
          fault === 'replacement' && styles.deviceRowReplacement
        ]}
      >
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[
              styles.iconButton, 
              fault && (fault === 'replacement' ? styles.iconButtonFaultRed : styles.iconButtonFaultOrange)
            ]} 
            onPress={() => {
              if (fault === 'replacement') {
                setReplacingDevice(device);
              } else {
                setFaultModalDevice(device);
                setIsFaultModalVisible(true);
              }
            }}
          >
            <Feather 
              name="alert-triangle" 
              size={16} 
              color={fault === 'replacement' ? '#DC2626' : (fault === 'inspection' ? '#D97706' : theme.colors.textMuted)} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => setTransferDevice(device)}
          >
            <Feather name="repeat" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => setHistoryDevice(device)}
          >
            <Feather name="clock" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.iconButton, styles.iconButtonDanger]} 
            onPress={() => device.id && handleDelete(device.id)}
          >
            <Feather name="trash-2" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
        <View style={styles.deviceInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.deviceType}>{device.type}</Text>
            {fault === 'inspection' && (
              <View style={styles.faultBadgeInspection}>
                <Feather name="alert-circle" size={10} color="#B45309" />
                <Text style={styles.faultBadgeTextInspection}>דרושה בדיקת קשר</Text>
              </View>
            )}
            {fault === 'replacement' && (
              <TouchableOpacity 
                style={styles.faultBadgeReplacement}
                onPress={() => setReplacingDevice(device)}
                activeOpacity={0.7}
              >
                <Feather name="alert-octagon" size={10} color="#B91C1C" />
                <Text style={styles.faultBadgeTextReplacement}>דורש החלפה</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.deviceTsadi}>צ&apos;: <Text style={styles.tsadiHighlight}>{device.tsadiNumber}</Text></Text>
          {groupBy === 'types' ? (
            <View style={styles.tagContainer}>
              <Text style={styles.tagText}>{device.assignment}</Text>
              {device.location ? <Text style={styles.tagText}>{device.location}</Text> : null}
            </View>
          ) : device.location ? (
            <View style={styles.tagContainer}>
              <Text style={styles.tagText}>{device.location}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }, [groupBy]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <OfflineBanner />
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.topHeaderIconOut} onPress={handleLogout}>
          <Feather name="log-out" size={18} color={theme.colors.danger} />
        </TouchableOpacity>
        <Text style={styles.topHeaderText}>דו"ח ציוד טקטי • מחזור א׳</Text>
        <TouchableOpacity style={styles.topHeaderIconIn}>
          <Feather name="shield" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Command Center</Text>
        <Text style={styles.subtitle}>ניהול ציוד ודיווח (קשר"ג)</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCopyReport}>
          <Feather name="copy" size={16} color={theme.colors.accent} />
          <Text style={styles.actionBtnText}>העתק דו"ח</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: 'rgba(59, 130, 246, 0.1)'}]} onPress={() => setAuditTrailVisible(true)}>
          <Feather name="activity" size={16} color={theme.colors.primary} />
          <Text style={[styles.actionBtnText, {color: theme.colors.primary}]}>יומן אירועים</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <SectionList
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 100 }}
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
              <View style={{ marginBottom: 16 }}>
                <View style={[styles.statusBoardContainer, { paddingHorizontal: 0, paddingBottom: 16 }]}>
                  {activeSession && activeSession.globalStatus !== 'pending' && activeSession.globalStatus !== 'archived' ? (
                    <View style={styles.activeSessionBoard}>
                      <View style={styles.boardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.pulsingIndicator} />
                          <Text style={styles.boardTitle}>דו&quot;ח יומי פעיל</Text>
                        </View>
                        {activeSession.globalStatus === 'active' ? (
                          <View style={{flexDirection: 'row', gap: 12}}>
                            <TouchableOpacity style={styles.resetSessionBtn} onPress={handleResetSession}>
                              <Feather name="refresh-ccw" size={14} color={theme.colors.danger} />
                              <Text style={styles.resetSessionBtnText}>איפוס</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.endSessionBtn} onPress={handleEndSession}>
                              <Text style={styles.endSessionBtnText}>סיים דו&quot;ח</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                      {renderStatusBars()}
                      {activeSession.globalStatus !== 'active' && (
                        <View style={{flexDirection: 'row', gap: 12, marginTop: 24}}>
                          <TouchableOpacity style={styles.startSessionBtn} onPress={handleStartSession}>
                            <Feather name="play" size={16} color="#FFF" />
                            <Text style={styles.startSessionBtnText}>הפעל דו&quot;ח לכל הפלוגות</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.historyLogsBtn} onPress={() => setHistoryModalVisible(true)}>
                            <Feather name="clock" size={16} color={theme.colors.primary} />
                            <Text style={styles.historyLogsBtnText}>היסטוריה</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noSessionBoard}>
                      <Text style={styles.noSessionText}>אין דו&quot;ח יומי פעיל</Text>
                      <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                        <TouchableOpacity style={styles.startSessionBtn} onPress={handleStartSession}>
                          <Text style={styles.startSessionBtnText}>פתח דו&quot;ח יומי</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.historyLogsBtn} onPress={() => setHistoryModalVisible(true)}>
                          <Text style={styles.historyLogsBtnText}>היסטוריית דוחות</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={[styles.controlsContainer, { paddingHorizontal: 0, borderBottomWidth: 0, padding: 0, marginTop: 8 }]}>
                  <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                    <TextInput 
                      style={styles.searchInput}
                      placeholder="חיפוש לפי צ' או סוג..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                  
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity 
                      style={[styles.toggleButton, groupBy === 'types' && styles.toggleButtonActive]}
                      onPress={() => setGroupBy('types')}
                    >
                      <Text style={[styles.toggleText, groupBy === 'types' && styles.toggleTextActive]}>לפי סוג מכשיר</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.toggleButton, groupBy === 'platoons' && styles.toggleButtonActive]}
                      onPress={() => setGroupBy('platoons')}
                    >
                      <Text style={[styles.toggleText, groupBy === 'platoons' && styles.toggleTextActive]}>לפי פלוגות</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>לא נמצא ציוד.</Text>}
          />
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

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
      
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Feather name="log-out" size={20} color={theme.colors.textMuted} />
          <Text style={styles.navText}>יציאה</Text>
        </TouchableOpacity>
        <View style={styles.navItem}>
          <Feather name="clock" size={20} color={theme.colors.textMuted} />
          <Text style={styles.navText}>ציר זמן</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => setModalVisible(true)}>
          <Feather name="plus-circle" size={20} color={theme.colors.textMuted} />
          <Text style={styles.navText}>הוספת ציוד</Text>
        </TouchableOpacity>
        <View style={styles.navItem}>
          <Feather name="shield" size={20} color={theme.colors.primary} />
          <Text style={[styles.navText, {color: theme.colors.primary, fontWeight: '700'}]}>קשר"ג</Text>
        </View>
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        message="הדו&quot;ח הועתק בהצלחה!"
        actionLabel="הבנתי"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  topHeaderIconOut: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderIconIn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '800',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 9999,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  statusBoardContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  noSessionBoard: {
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  noSessionText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  startSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 9999,
  },
  startSessionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  historyLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 9999,
  },
  historyLogsBtnText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  activeSessionBoard: {
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pulsingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.danger,
    // Add pulsing animation in a real implementation
  },
  boardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  endSessionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    ...(theme.elevation?.sm as object || {}),
  },
  endSessionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  resetSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
  },
  resetSessionBtnText: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  progressContainer: {
    gap: 16,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressLabel: {
    width: 90,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'right',
  },
  progressBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  progressText: {
    width: 44,
    fontSize: 13,
    textAlign: 'left',
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  controlsContainer: {
    padding: theme.spacing.lg,
    backgroundColor: 'transparent',
    marginBottom: theme.spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
    ...(theme.elevation?.sm as object || {}),
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: 16,
    fontSize: 16,
    textAlign: 'right',
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.full,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.surface,
    ...(theme.elevation?.sm as object || {}),
  },
  toggleText: {
    fontSize: 15,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginTop: 40,
    fontSize: 16,
    fontWeight: '500',
  },
  accordionHeaderContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginTop: 10,
    marginBottom: 6,
    marginHorizontal: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRightWidth: 4,
    borderRightColor: theme.colors.primary,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(67, 56, 202, 0.03)',
  },
  accordionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accordionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  accordionSummary: {
    fontSize: 14,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accordionIcon: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  deviceInfo: {
    alignItems: 'flex-end',
    flex: 1,
    paddingRight: 16,
  },
  deviceType: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  deviceTsadi: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  tsadiHighlight: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  tagText: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
    overflow: 'hidden',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 76, 58, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  iconButtonFaultOrange: {
    backgroundColor: '#FEF3C7',
  },
  iconButtonFaultRed: {
    backgroundColor: '#FEE2E2',
  },
  deviceRowInspection: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
    borderWidth: 1.5,
  },
  deviceRowReplacement: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
  },
  faultBadgeInspection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
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
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
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
    borderRadius: 8,
  },
  brigadeReplaceBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  fabIcon: {
    fontSize: 32,
    color: 'white',
    lineHeight: 34,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  miniReopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniReopenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  completedBadge: {
    backgroundColor: 'rgba(15, 76, 58, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(15, 76, 58, 0.2)',
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reopenButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  miniResetBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetPlatoonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resetPlatoonButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.danger,
  },
});
