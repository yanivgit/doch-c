import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { VerificationHistory, getHistoryLogs, deleteHistoryLog } from '../firebase/api';
import { theme } from '../theme/theme';
import Accordion from './Accordion';

interface Props {
  visible: boolean;
  onClose: () => void;
  dohId: string;
}

export default function VerificationHistoryModal({ visible, onClose, dohId }: Props) {
  const [logs, setLogs] = useState<VerificationHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const fetchedLogs = await getHistoryLogs(dohId);
    setLogs(fetchedLogs);
    setLoading(false);
  }, [dohId]);

  useEffect(() => {
    if (visible && dohId) {
      loadLogs();
    }
  }, [visible, dohId, loadLogs]);

  const handleDeleteLog = (logId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('האם אתה בטוח שברצונך למחוק היסטוריה זו?')) {
        deleteHistoryLog(logId).then(loadLogs).catch(() => window.alert('שגיאה במחיקה'));
      }
      return;
    }
    Alert.alert('מחיקת היסטוריה', 'האם אתה בטוח שברצונך למחוק היסטוריה זו?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: async () => {
        try {
          await deleteHistoryLog(logId);
          await loadLogs();
        } catch {
          Alert.alert('שגיאה', 'לא ניתן למחוק את ההיסטוריה');
        }
      }}
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>היסטוריית דוחות (מחזור נוכחי)</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>אין היסטוריית דוחות למחזור זה</Text>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={logs}
              keyExtractor={(log) => log.id || Math.random().toString()}
              renderItem={({ item: log }) => (
                <View style={[styles.logCard, log.status === 'לא הושלם' && styles.logCardIncomplete]}>
                  <View style={styles.logHeader}>
                    <View>
                      <Text style={styles.logDate}>{log.date}</Text>
                      <Text style={styles.logProgressText}>הושלם: {log.overallProgress}</Text>
                    </View>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                      <View style={[styles.statusBadge, log.status === 'בוצע' ? styles.statusSuccess : styles.statusDanger]}>
                        <Text style={styles.statusText}>{log.status}</Text>
                      </View>
                      <TouchableOpacity onPress={() => log.id && handleDeleteLog(log.id)} style={styles.deleteLogBtn}>
                        <Text style={styles.deleteLogBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {log.status === 'לא הושלם' && log.missingDevices && log.missingDevices.length > 0 ? (
                    <View style={styles.missingSection}>
                      <Accordion title="⚠️ ציוד חסר (לא נבדק)" summary={`${log.missingDevices.length} פריטים`}>
                        <View style={styles.missingList}>
                          {Object.entries(
                            log.missingDevices.reduce((acc, d) => {
                              const key = d.assignment || 'ללא שיוך';
                              if (!acc[key]) acc[key] = [];
                              acc[key].push(d);
                              return acc;
                            }, {} as Record<string, typeof log.missingDevices>)
                          ).sort(([a], [b]) => a.localeCompare(b)).map(([platoon, devices]) => (
                            <View key={platoon} style={styles.missingGroup}>
                              <Text style={styles.missingGroupTitle}>{platoon}</Text>
                              {devices.map(d => (
                                <View key={d.id} style={styles.missingItemRow}>
                                  <Text style={styles.missingItemType}>{d.type}</Text>
                                  <Text style={styles.missingItemTsadi}>צ&apos;: {d.tsadiNumber}</Text>
                                  {d.location ? <Text style={styles.missingItemLocation}>מיקום: {d.location}</Text> : null}
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </Accordion>
                    </View>
                  ) : null}
                  
                  <Accordion title="פירוט לפי פלוגות" summary="">
                    <View style={styles.platoonList}>
                      {Object.entries(log.platoonBreakdown).map(([platoon, progress]) => {
                        const isDone = progress.includes('(100%)');
                        return (
                          <View key={platoon} style={styles.platoonRow}>
                            <Text style={styles.platoonName}>{platoon}</Text>
                            <View style={styles.platoonProgress}>
                              <Text style={styles.platoonProgressText}>{progress}</Text>
                              {isDone ? <Text style={styles.doneIcon}>✅</Text> : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Accordion>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    height: '80%',
    padding: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 5,
  },
  closeBtnText: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  list: {
    flex: 1,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  logHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  logProgressText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteLogBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteLogBtnText: {
    fontSize: 18,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  logCardIncomplete: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  missingSection: {
    marginBottom: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  missingList: {
    padding: 10,
  },
  missingGroup: {
    marginBottom: 12,
  },
  missingGroupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.danger,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
    paddingBottom: 4,
  },
  missingItemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  missingItemType: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  missingItemTsadi: {
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  missingItemLocation: {
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
    textAlign: 'left',
  },
  platoonList: {
    gap: 8,
    paddingVertical: 8,
  },
  platoonRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  platoonName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  platoonProgress: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  platoonProgressText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  doneIcon: {
    fontSize: 14,
  }
});
