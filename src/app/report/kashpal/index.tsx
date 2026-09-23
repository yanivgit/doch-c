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
import { Feather } from '@expo/vector-icons';

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
        <View style={{flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8}}>
          <Text style={[styles.platoonProgressText, isDone && { color: theme.colors.success }]}>
            {isDone ? 'סיימת את הדו"ח בהצלחה!' : `התקדמות:`}
          </Text>
          <Text style={[styles.platoonProgressText, isDone && { color: theme.colors.success }]}>
            {verified}/{total}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: isDone ? theme.colors.success : theme.colors.accent }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Feather name="log-out" size={16} color={theme.colors.danger} />
          <Text style={styles.logoutButtonText}>התנתק</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>תצוגת ציוד (קשפ&quot;ל)</Text>
          <Text style={styles.subtitle}>דו&quot;ח פעיל: {selectedDohName || selectedDohId}</Text>
        </View>
        <View style={{ width: 80 }} />
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
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceType}>{device.type}</Text>
                        <Text style={styles.deviceTsadi}>צ&apos;: <Text style={styles.tsadiHighlight}>{device.tsadiNumber}</Text></Text>
                        {device.location ? (
                          <View style={styles.tagContainer}>
                            <Text style={styles.tagText}>{device.location}</Text>
                          </View>
                        ) : null}
                      </View>
                      <TouchableOpacity onPress={() => setEditingDevice(device)} style={styles.iconButton}>
                        <Feather name="map-pin" size={18} color={theme.colors.primary} />
                      </TouchableOpacity>
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
                      <View style={[styles.sessionBanner, styles.activeSessionBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                        <Feather name="check-circle" size={24} color={theme.colors.success} style={{ marginBottom: 8 }} />
                        <Text style={styles.sessionBannerTitle}>סיימת את הדו&quot;ח בהצלחה!</Text>
                        <Text style={styles.sessionBannerSub}>הקשר&quot;ג עודכן. תוכל להמשיך לסרוק אם נדרש.</Text>
                        {renderPlatoonProgress()}
                      </View>
                    ) : isMyPlatoonActive ? (
                      <View style={[styles.sessionBanner, styles.activeSessionBanner]}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <View style={styles.pulsingIndicator} />
                          <Text style={styles.sessionBannerTitle}>יש דו&quot;ח פעיל!</Text>
                        </View>
                        <Text style={styles.sessionBannerSub}>לחץ לחיצה ארוכה על הציוד כדי לאשר אותו.</Text>
                        {renderPlatoonProgress()}
                        <TouchableOpacity style={[styles.startSessionBtn, { backgroundColor: theme.colors.success }]} onPress={handleEndSession}>
                          <Text style={styles.startSessionBtnText}>סיימתי דו&quot;ח</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.sessionBanner, styles.noSessionBanner]}>
                        <Feather name="info" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
                        <Text style={styles.sessionBannerTitle}>אין דו&quot;ח פעיל כרגע</Text>
                        <TouchableOpacity style={styles.startSessionBtn} onPress={handleStartSession}>
                          <Feather name="play" size={18} color="#FFF" />
                          <Text style={styles.startSessionBtnText}>התחל דו&quot;ח עצמאי</Text>
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
                              <Text style={[styles.deviceTsadi, isVerified && styles.verifiedText]}>צ&apos;: <Text style={styles.tsadiHighlight}>{device.tsadiNumber}</Text></Text>
                              {device.location ? (
                                <View style={styles.tagContainer}>
                                  <Text style={[styles.tagText, isVerified && styles.verifiedText]}>{device.location}</Text>
                                </View>
                              ) : null}
                            </View>
                            {canVerify && (
                              <View style={[styles.checkbox, isVerified && styles.checkboxChecked]}>
                                {isVerified ? <Feather name="check" size={20} color="#FFF" /> : null}
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
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    ...(theme.elevation?.sm as object || {}),
    zIndex: 10,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: theme.spacing.sm,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: theme.borderRadius.full,
  },
  logoutButtonText: {
    fontSize: 14,
    color: theme.colors.danger,
    fontWeight: '700',
  },
  selectorContainer: {
    padding: 20,
    backgroundColor: theme.colors.background,
    zIndex: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'right',
    color: theme.colors.text,
  },
  tabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: theme.colors.surfaceLight,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: theme.borderRadius.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  activeTab: {
    backgroundColor: theme.colors.surface,
    ...(theme.elevation?.sm as object || {}),
  },
  tabText: {
    fontSize: 15,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  infoBanner: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(59, 130, 246, 0.08)', 
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: '700',
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
    fontWeight: '500',
  },
  deviceCard: {
    backgroundColor: theme.colors.surface,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12,
    ...(theme.elevation?.sm as object || {}),
  },
  deviceInfo: {
    alignItems: 'flex-end',
    flex: 1,
  },
  deviceType: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  deviceTsadi: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
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
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
    overflow: 'hidden',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBanner: {
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    ...(theme.elevation?.md as object || {}),
  },
  activeSessionBanner: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  noSessionBanner: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sessionBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sessionBannerSub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  pulsingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.danger,
  },
  startSessionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    marginTop: 16,
    ...(theme.elevation?.sm as object || {}),
  },
  startSessionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  platoonProgressWrapper: {
    width: '100%',
    marginTop: 16,
  },
  platoonProgressText: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    width: '100%',
    flexDirection: 'row-reverse',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  deviceCardVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  deviceCardReadOnly: {
    opacity: 0.9,
  },
  verifiedText: {
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  checkbox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    backgroundColor: theme.colors.surface,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  }
});
