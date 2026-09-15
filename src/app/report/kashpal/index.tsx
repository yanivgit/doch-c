import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Snackbar from '../../../components/Snackbar';
import * as Haptics from 'expo-haptics';
import { useApp } from '../../../context/AppContext';
import { Device, VerificationSession, verifyDevice, startKashpalSession, endKashpalSession, getDailyDocId, getDevicesByPlatoonAndDohId } from '../../../firebase/api';
import { db } from '../../../firebase/config';
import { onSnapshot, doc } from 'firebase/firestore';
import SearchableDropdown from '../../../components/SearchableDropdown';
import EditLocationModal from '../../../components/EditLocationModal';
import { theme } from '../../../theme/theme';
import { PLUGOT } from '../../../constants/data';

export default function KashpalReportScreen() {
  const { selectedDohId, selectedDohName, selectedPlatoon, selectPlatoon, logout } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<VerificationSession | null>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'audit'>('view');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!selectedPlatoon || !selectedDohId) return;
    setLoading(true);
    try {
      const platoonDevices = await getDevicesByPlatoonAndDohId(selectedPlatoon, selectedDohId);
      setDevices(platoonDevices);
    } catch (error) {
      console.error(error);
      Alert.alert('שגיאה', 'לא הצלחנו לטעון את הציוד. נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  }, [selectedPlatoon, selectedDohId]);

  // Effect 1: Fetch devices when platoon or doh changes
  useEffect(() => {
    fetchDevices();
  }, [selectedPlatoon, selectedDohId, fetchDevices]);

  // Effect 2: Manage active session subscription based ONLY on dohId
  useEffect(() => {

    if (!selectedDohId) return;

    const docId = getDailyDocId(selectedDohId);
    const docRef = doc(db, 'verificationSessions', docId);

    const unsubscribe = onSnapshot(docRef, (snap) => {
      try {
        if (!snap.exists()) {
          setActiveSession(null);
          setActiveTab('view');
          return;
        }
        
        const sessionData = { id: snap.id, ...snap.data() } as VerificationSession;
        
        if (sessionData.globalStatus === 'archived') {
          setActiveSession(null);
          setActiveTab('view');
        } else {
          setActiveSession(sessionData);
          
          // Auto-switch to audit if this specific platoon is active or global is active
          const myPlatoonActive = sessionData.platoons?.[selectedPlatoon || '']?.status === 'active' || sessionData.globalStatus === 'active';
          if (myPlatoonActive) {
            setActiveTab('audit');
          }
        }
      } catch (error) {
        console.error("Error processing snapshot:", error);
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      Alert.alert('שגיאה', 'אבד החיבור לשרת. מנסה להתחבר מחדש...');
    });

    return () => unsubscribe();
  }, [selectedDohId, selectedPlatoon]);

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
        Alert.alert('שגיאה', 'הדו&quot;ח היומי כבר ננעל והועבר להיסטוריה על ידי הקשר&quot;ג.');
      } else {
        Alert.alert('שגיאה', 'לא ניתן ליצור דו&quot;ח חדש');
      }
    }
  };

  const handleEndSession = async () => {
    if (!selectedDohId || !selectedPlatoon) return;
    Alert.alert(
      'סיום דו"ח',
      'האם אתה בטוח שסיימת לספור את כל הציוד בפלוגה שלך? פעולה זו תסמן לקשר"ג שסיימת.',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'סיימתי', 
          style: 'default',
          onPress: async () => {
            try {
              await endKashpalSession(selectedDohId, selectedPlatoon);
              setActiveTab('view');
            } catch {
              Alert.alert('שגיאה', 'לא ניתן לסיים דו&quot;ח.');
            }
          }
        }
      ]
    );
  };

  const handleVerifyDevice = async (deviceId: string) => {
    if (!activeSession || !activeSession.id || !selectedPlatoon) return;
    try {
      await verifyDevice(activeSession.id, deviceId, `kashpal_${selectedPlatoon}`);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לסמן את המכשיר. נסה שוב.');
    }
  };

  const renderPlatoonProgress = () => {
    if (!activeSession) return null;
    const total = devices.length;
    const verified = devices.filter(d => d.id && activeSession.verifiedDevices?.[d.id]).length;
    const percentage = total > 0 ? (verified / total) * 100 : 0;
    const isDone = percentage === 100 && total > 0;
    
    return (
      <View style={styles.platoonProgressWrapper}>
        <Text style={[styles.platoonProgressText, isDone && { color: theme.colors.success }]}>{isDone ? 'סיימת את הדו"ח בהצלחה! ✅' : `התקדמות: ${verified}/${total}`}</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: isDone ? theme.colors.success : theme.colors.primary }]} />
        </View>
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
          <Text style={styles.title}>תצוגת ציוד (קשפ&quot;ל)</Text>
          <Text style={styles.subtitle}>דו&quot;ח נוכחי: {selectedDohName || selectedDohId}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>


      {selectedPlatoon ? (
        <View style={{ flex: 1 }}>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, activeTab === 'view' && styles.activeTab]} onPress={() => setActiveTab('view')}>
              <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>רשימת ציוד</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'audit' && styles.activeTab]} onPress={() => setActiveTab('audit')}>
              <Text style={[styles.tabText, activeTab === 'audit' && styles.activeTabText]}>מסדר ציוד</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>מציג ציוד עבור: {selectedPlatoon} ({devices.length} פריטים)</Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {activeTab === 'view' && (
                <FlatList
                  style={styles.listContainer}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  keyboardShouldPersistTaps="handled"
                  data={devices}
                  keyExtractor={(device) => device.id || Math.random().toString()}
                  ListEmptyComponent={<Text style={styles.emptyText}>לא נמצא ציוד לפלוגה זו.</Text>}
                  renderItem={({ item: device }) => (
                    <View style={styles.deviceCard}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceType}>{device.type}</Text>
                          <Text style={styles.deviceTsadi}>צ&apos;: {device.tsadiNumber}</Text>
                          {device.location ? (
                            <Text style={styles.deviceSub}>מיקום: {device.location}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity onPress={() => setEditingDevice(device)} style={styles.editLocationBtn}>
                          <Text style={styles.editLocationIcon}>📍 עדכן מיקום</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}

              {activeTab === 'audit' && (() => {
                const isMyPlatoonActive = activeSession?.platoons?.[selectedPlatoon]?.status === 'active' || activeSession?.globalStatus === 'active';
                const isMyPlatoonCompleted = activeSession?.platoons?.[selectedPlatoon]?.status === 'completed';

                return (
                  <View style={{ flex: 1 }}>
                    {isMyPlatoonCompleted ? (
                      <View style={[styles.sessionBanner, styles.activeSessionBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                        <Text style={styles.sessionBannerTitle}>סיימת את הדו&quot;ח בהצלחה! ✅</Text>
                        <Text style={styles.sessionBannerSub}>הקשר&quot;ג עודכן. תוכל להמשיך לסרוק אם נדרש.</Text>
                        {renderPlatoonProgress()}
                      </View>
                    ) : isMyPlatoonActive ? (
                      <View style={[styles.sessionBanner, styles.activeSessionBanner]}>
                        <Text style={styles.sessionBannerTitle}>יש דו&quot;ח פעיל!</Text>
                        <Text style={styles.sessionBannerSub}>לחץ לחיצה ארוכה על הציוד כדי לאשר אותו.</Text>
                        {renderPlatoonProgress()}
                        <TouchableOpacity style={[styles.startSessionBtn, { backgroundColor: theme.colors.success }]} onPress={handleEndSession}>
                          <Text style={styles.startSessionBtnText}>סיימתי דו&quot;ח</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.sessionBanner, styles.noSessionBanner]}>
                        <Text style={styles.sessionBannerTitle}>אין דו&quot;ח פעיל כרגע</Text>
                        <TouchableOpacity style={styles.startSessionBtn} onPress={handleStartSession}>
                          <Text style={styles.startSessionBtnText}>התחל דו&quot;ח עצמאי לפלוגה</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <FlatList
                      style={styles.listContainer}
                      contentContainerStyle={{ paddingBottom: 40 }}
                      keyboardShouldPersistTaps="handled"
                      data={devices}
                      keyExtractor={(device) => device.id || Math.random().toString()}
                      ListEmptyComponent={<Text style={styles.emptyText}>לא נמצא ציוד לפלוגה זו.</Text>}
                      renderItem={({ item: device }) => {
                        const isVerified = device.id && activeSession?.verifiedDevices?.[device.id];
                        const canVerify = isMyPlatoonActive || isMyPlatoonCompleted;
                        return (
                          <TouchableOpacity 
                            style={[
                              styles.deviceCard, 
                              isVerified && styles.deviceCardVerified,
                              !canVerify && styles.deviceCardReadOnly
                            ]}
                            activeOpacity={0.7}
                            delayLongPress={500}
                            onPress={() => {
                              if (canVerify && device.id && !isVerified) {
                                setSnackbarVisible(true);
                              }
                            }}
                            onLongPress={() => {
                              if (canVerify && device.id && !isVerified) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
                                handleVerifyDevice(device.id);
                              }
                            }}
                            disabled={!canVerify || !!isVerified}
                          >
                            <View style={styles.deviceInfo}>
                              <Text style={[styles.deviceType, isVerified && styles.verifiedText]}>{device.type}</Text>
                              <Text style={[styles.deviceTsadi, isVerified && styles.verifiedText]}>צ&apos;: {device.tsadiNumber}</Text>
                              {device.location ? (
                                <Text style={[styles.deviceSub, isVerified && styles.verifiedText]}>מיקום: {device.location}</Text>
                              ) : null}
                            </View>
                            {canVerify && (
                              <View style={[styles.checkbox, isVerified && styles.checkboxChecked]}>
                                {isVerified ? <Text style={styles.checkboxIcon}>✓</Text> : null}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      }}
                    />
                </View>
              );
              })()}
            </View>
          )}

          <EditLocationModal
            visible={!!editingDevice}
            device={editingDevice}
            onClose={() => setEditingDevice(null)}
            onUpdate={() => {
              setEditingDevice(null);
              fetchDevices();
            }}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>בחר את הפלוגה שלך:</Text>
            <View style={{ zIndex: 10 }}>
              <SearchableDropdown
                data={PLUGOT as unknown as string[]}
                value={selectedPlatoon || ''}
                onSelect={selectPlatoon}
                placeholder="חפש פלוגה..."
              />
            </View>
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyText}>אנא בחר פלוגה כדי לצפות בציוד המשויך אליה</Text>
          </View>
        </View>
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        message="לחץ לחיצה ארוכה כדי לסמן ציוד כנמצא"
        actionLabel="הבנתי"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 1,
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
  selectorContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'right',
    color: theme.colors.text,
  },
  tabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  infoBanner: {
    padding: 12,
    backgroundColor: 'rgba(67, 56, 202, 0.15)', // Light primary tint
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(67, 56, 202, 0.3)',
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  deviceCard: {
    backgroundColor: theme.colors.surface,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: theme.borderRadius.md,
    marginBottom: 16,
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderRightWidth: 4, // Switched to right for RTL
    borderRightColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deviceInfo: {
    alignItems: 'flex-end',
  },
  deviceType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  deviceTsadi: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  deviceSub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  editLocationBtn: {
    padding: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editLocationIcon: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  sessionBanner: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  activeSessionBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue
    borderBottomColor: 'rgba(59, 130, 246, 0.3)',
  },
  noSessionBanner: {
    backgroundColor: theme.colors.surfaceLight,
    borderBottomColor: theme.colors.border,
  },
  sessionBannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sessionBannerSub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  startSessionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: 12,
  },
  startSessionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  platoonProgressWrapper: {
    width: '100%',
    marginTop: 15,
  },
  platoonProgressText: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.primary,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
  },
  deviceCardVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Light green tint
    borderColor: theme.colors.success,
    borderRightColor: theme.colors.success,
  },
  deviceCardReadOnly: {
    opacity: 0.8,
  },
  verifiedText: {
    opacity: 0.7,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  checkboxIcon: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
