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
    } catch {
      Alert.alert('שגיאה', 'לא ניתן ליצור דו&quot;ח חדש');
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
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>התנתק</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>ניהול דו&quot;ח צ (קשר&quot;ג)</Text>
          <Text style={styles.subtitle}>דו&quot;ח נוכחי: {selectedDohName || selectedDohId}</Text>
        </View>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopyReport}>
          <Text style={styles.copyButtonText}>העתק דו&quot;ח</Text>
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
                        <Text style={styles.boardTitle}>🔴 דו&quot;ח יומי פעיל</Text>
                        {activeSession.globalStatus === 'active' ? (
                          <View style={{flexDirection: 'row', gap: 10}}>
                            <TouchableOpacity style={styles.resetSessionBtn} onPress={handleResetSession}>
                              <Text style={styles.resetSessionBtnText}>איפוס דו&quot;ח</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.endSessionBtn} onPress={handleEndSession}>
                              <Text style={styles.endSessionBtnText}>סיום ושמירה</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                      {renderStatusBars()}
                      {activeSession.globalStatus !== 'active' && (
                        <View style={{flexDirection: 'row-reverse', gap: 10, marginTop: 16}}>
                          <TouchableOpacity style={styles.startSessionBtn} onPress={handleStartSession}>
                            <Text style={styles.startSessionBtnText}>פתח דו&quot;ח יומי (הפעל לכל הפלוגות)</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.historyLogsBtn} onPress={() => setHistoryModalVisible(true)}>
                            <Text style={styles.historyLogsBtnText}>היסטוריית דוחות</Text>
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

                <View style={[styles.controlsContainer, { paddingHorizontal: 0, borderBottomWidth: 0, padding: 0 }]}>
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="חיפוש לפי מספר צ' או סוג..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  
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
                          style={styles.deleteButton} 
                          onPress={() => device.id && handleDelete(device.id)}
                        >
                          <Text style={styles.deleteIcon}>🗑️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.historyButton} 
                          onPress={() => setHistoryDevice(device)}
                        >
                          <Text style={styles.historyIcon}>🕒</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.transferButton} 
                          onPress={() => setTransferDevice(device)}
                        >
                          <Text style={styles.transferIcon}>🔄</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceType}>{device.type}</Text>
                        <Text style={styles.deviceTsadi}>צ&apos;: {device.tsadiNumber}</Text>
                        {groupBy === 'types' ? (
                          <Text style={styles.deviceSub}>
                            שיוך: {device.assignment}{device.location ? ` | ${device.location}` : ''}
                          </Text>
                        ) : device.location ? (
                          <Text style={styles.deviceSub}>מיקום: {device.location}</Text>
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
    padding: 20,
    paddingTop: 0,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutButtonText: {
    fontSize: 16,
    color: theme.colors.danger,
    fontWeight: 'bold',
  },
  copyButton: {
    padding: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Light green
    borderRadius: theme.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  copyButtonText: {
    fontSize: 14,
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  statusBoardContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: theme.colors.surface,
  },
  noSessionBoard: {
    backgroundColor: theme.colors.surfaceLight,
    padding: 20,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  noSessionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textMuted,
  },
  startSessionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
  },
  startSessionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  historyLogsBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  historyLogsBtnText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  activeSessionBoard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    elevation: 3,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  boardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 10,
  },
  boardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  endSessionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  endSessionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  resetSessionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetSessionBtnText: {
    color: theme.colors.danger,
    fontWeight: 'bold',
  },
  progressContainer: {
    gap: 12,
  },
  progressBarRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  progressLabel: {
    width: 90,
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'right',
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  progressBarFill: {
    height: '100%',
  },
  progressText: {
    width: 40,
    fontSize: 14,
    textAlign: 'left',
    color: theme.colors.textMuted,
  },
  doneIcon: {
    fontSize: 14,
  },
  controlsContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    fontSize: 16,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.surfaceLight,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: 'bold',
  },
  toggleTextActive: {
    color: theme.colors.primary,
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
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 8,
    elevation: 1,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  deviceInfo: {
    alignItems: 'flex-end',
  },
  deviceType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  deviceTsadi: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  deviceSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // Danger with opacity
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  deleteIcon: {
    fontSize: 18,
  },
  historyButton: {
    padding: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)', // Warning with opacity
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  historyIcon: {
    fontSize: 18,
  },
  transferButton: {
    padding: 10,
    backgroundColor: 'rgba(67, 56, 202, 0.2)', // Primary with opacity
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.5)',
  },
  transferIcon: {
    fontSize: 18,
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
  }
});
