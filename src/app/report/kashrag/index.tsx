import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { getAllDevices, Device, deleteDevice, VerificationSession, archiveSession, resetSession, getDailyDocId, startGlobalSession } from '../../../firebase/api';
import { db } from '../../../firebase/config';
import { onSnapshot, doc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import Accordion from '../../../components/Accordion';
import AddDeviceModal from '../../../components/AddDeviceModal';
import TransferDeviceModal from '../../../components/TransferDeviceModal';
import DeviceHistoryModal from '../../../components/DeviceHistoryModal';
import Snackbar from '../../../components/Snackbar';
import { theme } from '../../../theme/theme';
import VerificationHistoryModal from '../../../components/VerificationHistoryModal';
import { Feather } from '@expo/vector-icons';
import DailySummaryModal from '../../../components/DailySummaryModal';

export default function KashragReportScreen() {
  const { selectedDohId, selectedDohName, logout } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [transferDevice, setTransferDevice] = useState<Device | null>(null);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'platoons' | 'types'>('platoons');
  
  // Verification Session State
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [auditTrailVisible, setAuditTrailVisible] = useState(false);
  const isArchivingRef = useRef(false);

  const fetchDevices = useCallback(async () => {
    if (!selectedDohId) return;
    setLoading(true);
    try {
      const data = await getAllDevices(selectedDohId);
      setDevices(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedDohId]);

  useEffect(() => {
    fetchDevices();

    if (!selectedDohId) return;

    const docId = getDailyDocId(selectedDohId);
    const docRef = doc(db, 'verificationSessions', docId);

    const unsubscribe = onSnapshot(docRef, async (snap) => {
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
              await archiveSession(sessionData, currentDevices);
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

    return () => {
      unsubscribe();
    };
  }, [selectedDohId, fetchDevices]);

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
    
    const confirmMessage = 'האם אתה בטוח שברצונך לסיים את הדו"ח הנוכחי? הנתונים יישמרו בהיסטוריה.';
    const processEndSession = async () => {
      setLoading(true);
      const currentDevices = await getAllDevices(selectedDohId as string);
      await archiveSession(activeSession, currentDevices);
      setLoading(false);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await processEndSession();
      }
      return;
    }

    Alert.alert('סיום דו"ח ושמירה', confirmMessage, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'סיים ושמור', style: 'default', onPress: processEndSession }
    ]);
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

  const platoonStats = useMemo(() => {
    if (!activeSession) return { platoons: [], platoonTotals: {}, platoonVerified: {} };
    
    const totals: Record<string, number> = {};
    const verifiedStats: Record<string, number> = {};
    
    devices.forEach(d => {
      const p = d.assignment || 'ללא שיוך';
      totals[p] = (totals[p] || 0) + 1;
      
      if (d.id && activeSession.verifiedDevices?.[d.id]) {
        verifiedStats[p] = (verifiedStats[p] || 0) + 1;
      }
    });

    return {
      platoons: Object.keys(totals).sort(),
      platoonTotals: totals,
      platoonVerified: verifiedStats
    };
  }, [devices, activeSession]);

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
          
          return (
            <View key={p} style={styles.progressBarRow}>
              <Text style={styles.progressLabel}>
                {p} 
                {isCompleted ? ' ✅' : (isStarted ? ' 🔄' : '')}
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[
                  styles.progressBarFill, 
                  { 
                    width: `${percentage}%`,
                    backgroundColor: isCompleted ? theme.colors.success : theme.colors.primary
                  }
                ]} />
              </View>
              <Text style={styles.progressText}>{verified}/{total}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
          <FlatList
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            data={groupKeys}
            keyExtractor={(key) => key}
            ListHeaderComponent={
              <View style={{ marginBottom: 16 }}>
                <View style={[styles.statusBoardContainer, { paddingHorizontal: 0, paddingBottom: 16 }]}>
                  {activeSession && activeSession.globalStatus !== 'pending' && activeSession.globalStatus !== 'archived' ? (
                    <View style={styles.activeSessionBoard}>
                      <View style={styles.boardHeader}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
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
                        <View style={{flexDirection: 'row-reverse', gap: 12, marginTop: 24}}>
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
                      <View style={{flexDirection: 'row-reverse', gap: 10, marginTop: 10}}>
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
            renderItem={({ item: key }) => {
              const groupItems = groupedDevices[key];
              return (
                <Accordion 
                  title={key} 
                  summary={`${groupItems.length} פריטים`}
                >
                  {groupItems.map(device => (
                    <View key={device.id} style={styles.deviceRow}>
                      <View style={styles.actionButtons}>
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
                        <Text style={styles.deviceType}>{device.type}</Text>
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
                  ))}
                </Accordion>
              );
            }}
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
  deviceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    marginBottom: 12,
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
  },
  tagContainer: {
    flexDirection: 'row-reverse',
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
});
