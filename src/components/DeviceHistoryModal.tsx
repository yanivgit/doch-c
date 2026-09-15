import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { getDeviceLogs, Device, LogEvent } from '../firebase/api';
import { theme } from '../theme/theme';

interface DeviceHistoryModalProps {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
}

export default function DeviceHistoryModal({ device, visible, onClose }: DeviceHistoryModalProps) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (device?.id && visible) {
      fetchLogs(device.id);
    }
  }, [device, visible]);

  const fetchLogs = async (deviceId: string) => {
    setLoading(true);
    try {
      const fetchedLogs = await getDeviceLogs(deviceId);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!device) return null;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return '🆕';
      case 'TRANSFER': return '🔄';
      case 'DELETE': return '🗑️';
      case 'CHECKED': return '✅';
      default: return '📝';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>היסטוריית מכשיר</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.deviceInfoContainer}>
            <Text style={styles.deviceInfoText}>
              {device.type} - צ&apos;: {device.tsadiNumber}
            </Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.listContainer}>
              {logs.length === 0 ? (
                <Text style={styles.emptyText}>לא נמצאה היסטוריה למכשיר זה.</Text>
              ) : (
                logs.map((log) => (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logDate}>{formatDate(log.timestamp)}</Text>
                      <View style={styles.actionBadge}>
                        <Text style={styles.actionIcon}>{getActionIcon(log.action)}</Text>
                        <Text style={styles.actionText}>{log.action}</Text>
                      </View>
                    </View>
                    <Text style={styles.logDetails}>{log.details}</Text>
                    <Text style={styles.logUser}>ע&quot;י: {log.user}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  deviceInfoContainer: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deviceInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 16,
    marginTop: 20,
  },
  logCard: {
    backgroundColor: theme.colors.background,
    padding: 20,
    borderRadius: theme.borderRadius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRightWidth: 4,
    borderRightColor: theme.colors.primary,
    elevation: 1,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logDate: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: 'bold',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  actionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  logDetails: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  logUser: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'left',
  }
});
