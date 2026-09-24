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

  useEffect(() => {
    fetchDevices();
  }, [selectedPlatoon, selectedDohId, fetchDevices]);

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
        Alert.alert('שגיאה', 'הדו"ח היומי כבר ננעל והועבר להיסטוריה על ידי הקשר"ג.');
      } else {
        Alert.alert('שגיאה', 'לא ניתן ליצור דו"ח חדש');
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
              Alert.alert('כל הכבוד!', 'הדו"ח היומי הסתיים ונשלח לקשר"ג בהצלחה!');
            } catch {
              Alert.alert('שגיאה', 'לא ניתן לסיים דו"ח.');
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
          <Text style={[styles.platoonProgressText, { color: theme.colors.primary }]}>
            התקדמות
          </Text>
          <Text style={[styles.platoonProgressText, { color: theme.colors.primary }]}>
            {verified}/{total}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.topHeaderIconOut} onPress={handleLogout}>
          <Feather name="log-out" size={18} color={theme.colors.danger} />
        </TouchableOpacity>
        <Text style={styles.topHeaderText}>דו"ח ציוד טקטי • מחזור א׳</Text>
        <TouchableOpacity style={styles.topHeaderIconIn}>
          <Feather name="user" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Field Checklist</Text>
        <Text style={styles.subtitle}>תצוגת ציוד פלוגתית</Text>
      </View>

      {selectedPlatoon ? (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          
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
                  contentContainerStyle={{ paddingBottom: 100 }}
                  keyboardShouldPersistTaps="handled"
                  data={devices}
                  keyExtractor={(device) => device.id || Math.random().toString()}
                  ListEmptyComponent={<Text style={styles.emptyText}>לא נמצא ציוד לפלוגה זו.</Text>}
                  renderItem={({ item: device }) => (
                    <View style={styles.deviceCard}>
                      <View style={styles.deviceCardRight}>
                        <View style={[styles.deviceIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                          <Feather name="cpu" size={20} color={theme.colors.accent} />
                        </View>
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceType}>{device.type}</Text>
                          <Text style={styles.deviceTsadi}>מק"ט: {device.tsadiNumber}</Text>
                        </View>
                      </View>
                      <View style={styles.deviceCardLeft}>
                        {device.location && (
                          <View style={styles.tagContainer}>
                            <Text style={styles.tagText}>{device.location}</Text>
                          </View>
                        )}
                        <TouchableOpacity onPress={() => setEditingDevice(device)} style={styles.iconButton}>
                          <Feather name="map-pin" size={18} color={theme.colors.primary} />
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
                    {(isMyPlatoonActive || isMyPlatoonCompleted) ? (
                      <View style={styles.sessionBanner}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                            <Feather name="zap" size={20} color={theme.colors.warning} />
                            <Text style={styles.sessionBannerTitle}>{isMyPlatoonCompleted ? 'הדו"ח הושלם!' : 'יש דו"ח פעיל!'}</Text>
                          </View>
                        </View>
                        <Text style={styles.sessionBannerSub}>לחץ לחיצה ארוכה על פריט לאישור קיומו בסד"כ</Text>
                        
                        {renderPlatoonProgress()}
                        
                        {!isMyPlatoonCompleted && (
                          <TouchableOpacity style={styles.startSessionBtn} onPress={handleEndSession}>
                            <Feather name="check-circle" size={20} color="#fff" />
                            <Text style={styles.startSessionBtnText}>סיימתי דיווח</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.sessionBanner, styles.noSessionBanner]}>
                        <Feather name="info" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
                        <Text style={styles.sessionBannerTitle}>אין דו"ח פעיל כרגע</Text>
                        <TouchableOpacity style={styles.startSessionBtn} onPress={handleStartSession}>
                          <Feather name="play" size={18} color="#FFF" />
                          <Text style={styles.startSessionBtnText}>התחל דו"ח עצמאי</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <FlatList
                      style={styles.listContainer}
                      contentContainerStyle={{ paddingBottom: 100 }}
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
                            <View style={styles.deviceCardRight}>
                              <View style={[styles.deviceIconWrapper, isVerified ? { backgroundColor: 'rgba(16, 185, 129, 0.15)' } : { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                <Feather name="cpu" size={20} color={isVerified ? theme.colors.success : theme.colors.accent} />
                              </View>
                              <View style={styles.deviceInfo}>
                                <Text style={[styles.deviceType, isVerified && styles.verifiedText]}>{device.type}</Text>
                                <Text style={[styles.deviceTsadi, isVerified && styles.verifiedText]}>מק"ט: {device.tsadiNumber}</Text>
                              </View>
                            </View>

                            <View style={styles.deviceCardLeft}>
                              {isVerified && (
                                <View style={styles.verifiedBadge}>
                                  <Text style={styles.verifiedBadgeText}>מאושר</Text>
                                </View>
                              )}
                              {canVerify && (
                                <View style={[styles.checkbox, isVerified && styles.checkboxChecked]}>
                                  {isVerified ? <Feather name="check" size={16} color="#FFF" /> : null}
                                </View>
                              )}
                            </View>
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
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
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

      {/* Bottom Navigation Mock */}
      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <Feather name="briefcase" size={20} color={theme.colors.primary} />
          <Text style={[styles.navText, {color: theme.colors.primary, fontWeight: '700'}]}>קשפ"ל</Text>
        </View>
        <View style={styles.navItem}>
          <Feather name="plus-circle" size={20} color={theme.colors.textMuted} />
          <Text style={styles.navText}>הוספת ציוד</Text>
        </View>
        <View style={styles.navItem}>
          <Feather name="clock" size={20} color={theme.colors.textMuted} />
          <Text style={styles.navText}>ציר זמן</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Feather name="log-out" size={20} color={theme.colors.textMuted} />
          <Text style={styles.navText}>יציאה</Text>
        </TouchableOpacity>
      </View>

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
  container: {
    flex: 1,
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
  selectorContainer: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
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
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 9999,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 9999,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 40,
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    marginBottom: 12,
  },
  deviceCardRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  deviceIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  deviceInfo: {
    alignItems: 'flex-end',
    flex: 1,
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
  deviceCardLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginRight: 12,
  },
  verifiedBadgeText: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  tagContainer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sessionBanner: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  noSessionBanner: {
    alignItems: 'center',
    borderColor: theme.colors.border,
  },
  sessionBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  sessionBannerSub: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  startSessionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 9999,
    width: '100%',
  },
  startSessionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  platoonProgressWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  platoonProgressText: {
    fontWeight: '800',
    fontSize: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 9999,
    overflow: 'hidden',
    width: '100%',
    flexDirection: 'row-reverse',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: theme.colors.success,
  },
  deviceCardVerified: {
    backgroundColor: '#FFFFFF',
    borderColor: theme.colors.success,
  },
  deviceCardReadOnly: {
    opacity: 0.9,
  },
  verifiedText: {
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row-reverse',
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
