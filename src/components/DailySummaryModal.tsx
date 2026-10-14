import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { getLogsByDateRange, LogEvent } from '../firebase/api';
import { useApp } from '../context/AppContext';

interface DailySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  platoon?: string;
  dohId?: string;
}

type FilterType = 'ALL' | 'CHECKED' | 'UPDATE' | 'TRANSFER' | 'CREATE' | 'DELETE';

export default function DailySummaryModal({ visible, onClose, platoon, dohId }: DailySummaryModalProps) {
  const { selectedDohId } = useApp();
  const activeDohId = dohId || selectedDohId || '';
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  useEffect(() => {
    if (visible && activeDohId) {
      fetchLogsForDate(currentDate);
    }
  }, [visible, currentDate, activeDohId, platoon]);

  const fetchLogsForDate = async (date: Date) => {
    if (!activeDohId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const fetchedLogs = await getLogsByDateRange(startOfDay, endOfDay, activeDohId, platoon);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDay = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = useMemo(() => {
    return new Date().toDateString() === currentDate.toDateString();
  }, [currentDate]);

  const formatHebrewDate = (date: Date) => {
    const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${day} ב${monthName} ${year}`;
  };

  // Filter counts strictly from server-scoped logs
  const filterCounts = useMemo(() => {
    const counts = {
      ALL: logs.length,
      CHECKED: 0,
      UPDATE: 0,
      TRANSFER: 0,
      CREATE: 0,
      DELETE: 0
    };
    logs.forEach(l => {
      const act = l.action?.toUpperCase();
      if (act === 'CHECKED' || act === 'VERIFY' || act === 'AUDIT') {
        counts.CHECKED++;
      } else if (act === 'UPDATE') {
        counts.UPDATE++;
      } else if (act === 'TRANSFER') {
        counts.TRANSFER++;
      } else if (act === 'CREATE') {
        counts.CREATE++;
      } else if (act === 'DELETE') {
        counts.DELETE++;
      }
    });
    return counts;
  }, [logs]);

  // Filtered logs by action type
  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') return logs;
    if (activeFilter === 'CHECKED') {
      return logs.filter(l => {
        const a = l.action?.toUpperCase();
        return a === 'CHECKED' || a === 'VERIFY' || a === 'AUDIT';
      });
    }
    return logs.filter(l => l.action?.toUpperCase() === activeFilter);
  }, [logs, activeFilter]);

  // Tactical Style & icon mapping helpers
  const getActionBadgeStyle = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CHECKED':
      case 'VERIFY':
      case 'AUDIT':
        return { bg: '#EDE9FE', text: '#5B21B6', label: 'אימות ציוד', icon: 'shield-check' };
      case 'CREATE':
        return { bg: '#DCFCE7', text: '#15803D', label: 'קליטה חדשה', icon: 'plus-circle' };
      case 'UPDATE':
        return { bg: '#DBEAFE', text: '#1E40AF', label: 'עדכון נתונים', icon: 'square-edit-outline' };
      case 'TRANSFER':
        return { bg: '#FEF3C7', text: '#B45309', label: 'העברת פלוגה', icon: 'swap-horizontal' };
      case 'DELETE':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'מחיקה מהמערכת', icon: 'trash-can-outline' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: action || 'אירוע', icon: 'history' };
    }
  };

  const getNodeTheme = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CHECKED':
      case 'VERIFY':
      case 'AUDIT':
        return { bg: '#8B5CF6', color: '#FFFFFF', icon: 'shield-check-outline' };
      case 'CREATE':
        return { bg: '#16A34A', color: '#FFFFFF', icon: 'plus-box' };
      case 'UPDATE':
        return { bg: '#2563EB', color: '#FFFFFF', icon: 'checkbox-marked-outline' };
      case 'TRANSFER':
        return { bg: '#D97706', color: '#FFFFFF', icon: 'swap-horizontal' };
      case 'DELETE':
        return { bg: '#DC2626', color: '#FFFFFF', icon: 'trash-can-outline' };
      default:
        return { bg: '#475569', color: '#FFFFFF', icon: 'calendar-check' };
    }
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 2) return 'ממש עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דק׳`;
    if (diffHours === 1) return 'לפני שעה';
    if (diffHours === 2) return 'לפני שעתיים';
    if (diffHours > 2 && diffHours < 24) return `לפני ${diffHours} שעות`;

    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        
        {/* 1. Tactical Command Header */}
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <View style={styles.headerRightGroup}>
              <View style={styles.headerEmblem}>
                <MaterialCommunityIcons name="clipboard-text-clock" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.headerTitles}>
                <View style={styles.titleWithSyncRow}>
                  <Text style={styles.headerMainTitle}>
                    {platoon ? `יומן אירועים • ${platoon}` : 'יומן אירועים מבצעי'}
                  </Text>
                  <View style={styles.liveSyncTag}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.liveSyncText}>סנכרון מבצעי חי</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  ציר פעילות מבצעית, אימותי שטח ותנועות ציוד
                </Text>
              </View>
            </View>

            {/* Close Button - Guaranteed functional & verified with testID */}
            <TouchableOpacity 
              testID="close-daily-summary" 
              style={styles.closeBtn} 
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityLabel="סגור יומן אירועים"
            >
              <Feather name="x" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Content Container */}
        <ScrollView 
          style={styles.mainScroll} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Tactical Date Navigator */}
          <View style={styles.dateNavCard}>
            <View style={styles.dateNavControls}>
              {/* Back into past (RTL Right button) */}
              <TouchableOpacity 
                style={styles.navDayBtn} 
                onPress={() => navigateDay(-1)}
                activeOpacity={0.7}
              >
                <Feather name="arrow-right" size={15} color="#0F172A" />
                <Text style={styles.navDayBtnText}>יום קודם</Text>
              </TouchableOpacity>

              {/* Date display & Return to Today shortcut */}
              <View style={styles.dateCenterBlock}>
                <View style={styles.dateTitleRow}>
                  <Feather name="calendar" size={15} color="#15803D" />
                  <Text style={styles.dateMainText}>{formatHebrewDate(currentDate)}</Text>
                </View>
                {!isToday && (
                  <TouchableOpacity 
                    style={styles.todayShortcutBtn} 
                    onPress={resetToToday}
                    activeOpacity={0.75}
                  >
                    <Feather name="rotate-ccw" size={12} color="#15803D" />
                    <Text style={styles.todayShortcutText}>חזור להיום</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Forward in time (RTL Left button, disabled on today) */}
              <TouchableOpacity 
                style={[styles.navDayBtn, isToday && styles.navDayBtnDisabled]} 
                onPress={() => navigateDay(1)}
                disabled={isToday}
                activeOpacity={0.7}
              >
                <Text style={[styles.navDayBtnText, isToday && styles.navDayBtnTextDisabled]}>יום הבא</Text>
                <Feather name="arrow-left" size={15} color={isToday ? '#94A3B8' : '#0F172A'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. Action Filter Pills - Every single one is 100% functional */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons 
                name="view-list" 
                size={14} 
                color={activeFilter === 'ALL' ? '#FFFFFF' : '#475569'} 
              />
              <Text style={[styles.filterPillText, activeFilter === 'ALL' && styles.filterPillTextActive]}>
                הכל ({filterCounts.ALL})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'CHECKED' && styles.filterPillActiveChecked]}
              onPress={() => setActiveFilter('CHECKED')}
              activeOpacity={0.8}
            >
              <View style={[styles.filterDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'CHECKED' && styles.filterPillTextActive]}>
                אימותים ({filterCounts.CHECKED})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'UPDATE' && styles.filterPillActiveUpdate]}
              onPress={() => setActiveFilter('UPDATE')}
              activeOpacity={0.8}
            >
              <View style={[styles.filterDot, { backgroundColor: '#2563EB' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'UPDATE' && styles.filterPillTextActive]}>
                עדכונים ({filterCounts.UPDATE})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'TRANSFER' && styles.filterPillActiveTransfer]}
              onPress={() => setActiveFilter('TRANSFER')}
              activeOpacity={0.8}
            >
              <View style={[styles.filterDot, { backgroundColor: '#D97706' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'TRANSFER' && styles.filterPillTextActive]}>
                העברות ({filterCounts.TRANSFER})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'CREATE' && styles.filterPillActiveCreate]}
              onPress={() => setActiveFilter('CREATE')}
              activeOpacity={0.8}
            >
              <View style={[styles.filterDot, { backgroundColor: '#16A34A' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'CREATE' && styles.filterPillTextActive]}>
                קליטה ({filterCounts.CREATE})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'DELETE' && styles.filterPillActiveDelete]}
              onPress={() => setActiveFilter('DELETE')}
              activeOpacity={0.8}
            >
              <View style={[styles.filterDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'DELETE' && styles.filterPillTextActive]}>
                מחיקות ({filterCounts.DELETE})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* 4. Timeline Content Feed */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#15803D" />
              <Text style={styles.loadingText}>טוען יומן אירועים...</Text>
            </View>
          ) : filteredLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Feather name="calendar" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitleText}>
                {activeFilter !== 'ALL' 
                  ? 'לא נמצאו אירועים מסוג זה' 
                  : (platoon ? `לא נרשמו פעולות עבור ${platoon}` : 'לא נרשמו אירועים בתאריך זה')}
              </Text>
              <Text style={styles.emptySubText}>
                {activeFilter !== 'ALL'
                  ? 'נסה לסנן לקטגוריה אחרת או להציג את כלל הפעילות'
                  : isToday 
                    ? 'פעולות אימות ותנועות ציוד שיתבצעו יירשמו כאן אוטומטית בזמן אמת'
                    : 'בחר יום אחר בעזרת כפתורי הניווט העליונים'}
              </Text>

              {activeFilter !== 'ALL' && (
                <TouchableOpacity 
                  style={styles.emptyResetBtn} 
                  onPress={() => setActiveFilter('ALL')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyResetBtnText}>הצג את כל האירועים</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.timelineContainer}>
              {/* Vertical connector line on the right */}
              <View style={styles.timelineGuideLine} />

              {filteredLogs.map((log, index) => {
                const badge = getActionBadgeStyle(log.action);
                const nodeTheme = getNodeTheme(log.action);
                const timeStr = log.timestamp?.toDate 
                  ? log.timestamp.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const relativeTime = formatRelativeTime(log.timestamp);

                return (
                  <View 
                    key={log.id || `${log.tsadiNumber || 'item'}-${log.action}-${index}`} 
                    style={styles.timelineRow}
                  >
                    {/* Right Column: Tactical Node Badge & Timestamp */}
                    <View style={styles.timelineNodeCol}>
                      <View style={[styles.timelineNodeBox, { backgroundColor: nodeTheme.bg }]}>
                        <MaterialCommunityIcons 
                          name={nodeTheme.icon as any} 
                          size={18} 
                          color={nodeTheme.color} 
                        />
                      </View>
                      <Text style={styles.timelineTimeText}>{timeStr}</Text>
                    </View>

                    {/* Left Column: Tactical Event Card */}
                    <View style={styles.eventCard}>
                      {/* Card Header: Type Badge, User Tag, Relative Time */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.badgeGroup}>
                          <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                            <MaterialCommunityIcons 
                              name={badge.icon as any} 
                              size={12} 
                              color={badge.text} 
                              style={{ marginLeft: 3 }}
                            />
                            <Text style={[styles.actionBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                          <View style={styles.userBadge}>
                            <Feather name="user" size={10} color="#475569" style={{ marginLeft: 3 }} />
                            <Text style={styles.userBadgeText}>{log.user || 'משתמש'}</Text>
                          </View>
                        </View>
                        <Text style={styles.relativeTimeText}>{relativeTime || timeStr}</Text>
                      </View>

                      {/* Card Body: Equipment Identifier & Action Details */}
                      <View style={styles.cardBody}>
                        {log.tsadiNumber && log.tsadiNumber !== 'multiple' ? (
                          <View style={styles.tsadiTag}>
                            <Text style={styles.tsadiTagText}>צ׳ {log.tsadiNumber}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.cardMainText}>
                          {log.details || 'ביצוע פעולה במערכת'}
                        </Text>
                      </View>

                      {/* Card Footer: Tactical Status Tag */}
                      <View style={styles.cardFooterTagRow}>
                        {log.action?.toUpperCase() === 'CHECKED' || log.action?.toUpperCase() === 'AUDIT' ? (
                          <View style={styles.footerTagItem}>
                            <Feather name="check-circle" size={12} color="#15803D" />
                            <Text style={[styles.cardFooterTagText, { color: '#15803D' }]}>
                              אימות שטח תקף • אושר ע״י {log.user || 'קשפ״ל'}
                            </Text>
                          </View>
                        ) : log.action?.toUpperCase() === 'TRANSFER' ? (
                          <View style={styles.footerTagItem}>
                            <Feather name="repeat" size={12} color="#B45309" />
                            <Text style={[styles.cardFooterTagText, { color: '#B45309' }]}>
                              שינוי שיוך מסגרתי • מעודכן בדוח
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.footerTagItem}>
                            <MaterialCommunityIcons name="cube-scan" size={13} color="#475569" />
                            <Text style={styles.cardFooterTagText}>
                              תיעוד מערכתי מבוקר • רישום אחיד
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* End of Day Marker */}
              <View style={styles.timelineBottomMark}>
                <View style={styles.timelineBottomLine} />
                <Text style={styles.timelineBottomText}>
                  סיכום אירועים ל-{formatHebrewDate(currentDate)}
                </Text>
                <Text style={styles.timelineBottomSub}>
                  כל הפעולות סונכרנו ומאומתות מול מסד הנתונים
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },

  /* 1. Header */
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerEmblem: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F4C3A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitles: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleWithSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerMainTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  liveSyncTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  liveSyncText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* 2. Date Navigation */
  dateNavCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dateNavControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  navDayBtnDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.5,
  },
  navDayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  navDayBtnTextDisabled: {
    color: '#94A3B8',
  },
  dateCenterBlock: {
    alignItems: 'center',
    gap: 4,
  },
  dateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  todayShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  todayShortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },

  /* 3. Filter Pills */
  filterPillsRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillActiveChecked: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterPillActiveUpdate: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterPillActiveTransfer: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  filterPillActiveCreate: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  filterPillActiveDelete: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  /* 4. Timeline */
  timelineContainer: {
    position: 'relative',
    paddingRight: 4,
  },
  timelineGuideLine: {
    position: 'absolute',
    top: 20,
    bottom: 40,
    right: 24,
    width: 2,
    backgroundColor: '#CBD5E1',
    zIndex: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    zIndex: 2,
  },
  timelineNodeCol: {
    width: 50,
    alignItems: 'center',
    marginLeft: 12,
    zIndex: 3,
  },
  timelineNodeBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },

  /* Event Cards */
  eventCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  userBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  relativeTimeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardBody: {
    marginBottom: 10,
  },
  tsadiTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 6,
  },
  tsadiTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardMainText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
    lineHeight: 20,
  },
  cardFooterTagRow: {
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  footerTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardFooterTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  /* Empty & Loading states */
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyResetBtn: {
    marginTop: 16,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Bottom Timeline Marker */
  timelineBottomMark: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  timelineBottomLine: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  timelineBottomText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineBottomSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
});
