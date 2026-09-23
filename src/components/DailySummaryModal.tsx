import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLogsByDateRange, LogEvent } from '../firebase/api';
import { theme } from '../theme/theme';

interface DailySummaryModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DailySummaryModal({ visible, onClose }: DailySummaryModalProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchLogsForDate(currentDate);
    }
  }, [visible, currentDate]);

  const fetchLogsForDate = async (date: Date) => {
    setLoading(true);
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const fetchedLogs = await getLogsByDateRange(startOfDay, endOfDay);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDay = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  const getActionColor = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'VERIFY':
      case 'VERIFIED':
        return theme.colors.success;
      case 'TRANSFER':
      case 'UPDATE':
        return theme.colors.primary;
      case 'DELETE':
      case 'MISSING':
        return theme.colors.danger;
      default:
        return theme.colors.textMuted;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'VERIFY':
      case 'VERIFIED':
        return 'check';
      case 'TRANSFER':
        return 'repeat';
      case 'UPDATE':
        return 'edit-2';
      case 'DELETE':
        return 'trash-2';
      default:
        return 'activity';
    }
  };

  const isToday = new Date().toDateString() === currentDate.toDateString();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ציר זמן יומי</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>

        <View style={styles.dateNavigator}>
          <TouchableOpacity onPress={() => navigateDay(1)} style={styles.navButton} disabled={isToday}>
            <Feather name="chevron-right" size={24} color={isToday ? theme.colors.textMuted : theme.colors.primary} />
            <Text style={[styles.navButtonText, isToday && { color: theme.colors.textMuted }]}>הבא</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={setToday} style={styles.dateDisplay}>
            <Feather name="calendar" size={18} color={theme.colors.primary} />
            <Text style={styles.dateText}>
              {isToday ? 'היום' : currentDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigateDay(-1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>הקודם</Text>
            <Feather name="chevron-left" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="inbox" size={48} color={theme.colors.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>אין פעילויות שתועדו ביום זה.</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const timeStr = item.timestamp?.toDate ? item.timestamp.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
              const isLast = index === logs.length - 1;

              return (
                <View style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timeText}>{timeStr}</Text>
                  </View>

                  <View style={styles.timelineCenter}>
                    <View style={[styles.timelineDot, { backgroundColor: getActionColor(item.action) }]}>
                      <Feather name={getActionIcon(item.action) as any} size={12} color="#fff" />
                    </View>
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  <View style={styles.timelineRight}>
                    <View style={styles.eventCard}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventUser}>{item.user}</Text>
                        <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) + '20' }]}>
                          <Text style={[styles.actionText, { color: getActionColor(item.action) }]}>
                            {item.action}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.eventDetails}>
                        <Text style={{ fontWeight: 'bold' }}>{item.tsadiNumber}</Text> - {item.details}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  iconButton: {
    padding: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceLight,
  },
  iconButtonPlaceholder: {
    width: 40,
  },
  dateNavigator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  navButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 8,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    marginHorizontal: 4,
  },
  dateDisplay: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  timelineItem: {
    flexDirection: 'row-reverse',
    minHeight: 80,
  },
  timelineLeft: {
    width: 60,
    alignItems: 'flex-start',
    paddingTop: 16,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  timelineCenter: {
    width: 40,
    alignItems: 'center',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    zIndex: 2,
    ...(theme.elevation?.sm as object || {}),
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: -8,
    marginBottom: -12,
    zIndex: 1,
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 16,
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    ...(theme.elevation?.sm as object || {}),
  },
  eventHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventUser: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  eventDetails: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    textAlign: 'right',
  },
});
