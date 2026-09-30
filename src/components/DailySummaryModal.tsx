import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getLogsByDateRange, LogEvent } from '../firebase/api';
import { useApp } from '../context/AppContext';

interface DailySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  platoon?: string;
  dohId?: string;
}

type FilterType = 'ALL' | 'CREATE' | 'UPDATE' | 'TRANSFER' | 'CHECKED' | 'DELETE';

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

  const isToday = useMemo(() => {
    return new Date().toDateString() === currentDate.toDateString();
  }, [currentDate]);

  const formatHebrewDate = (date: Date) => {
    const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName}, ${day}.${month}`;
  };

  // Filter counts strictly from server-scoped logs
  const filterCounts = useMemo(() => {
    const counts = {
      ALL: logs.length,
      CREATE: 0,
      UPDATE: 0,
      TRANSFER: 0,
      CHECKED: 0,
      DELETE: 0
    };
    logs.forEach(l => {
      const act = l.action?.toUpperCase() as keyof typeof counts;
      if (counts[act] !== undefined) {
        counts[act]++;
      }
    });
    return counts;
  }, [logs]);

  // Filtered logs by action type
  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') return logs;
    return logs.filter(l => l.action?.toUpperCase() === activeFilter);
  }, [logs, activeFilter]);

  // Style & icon mapping helpers
  const getActionBadgeStyle = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CREATE':
        return { bg: '#DCFCE7', text: '#15803D', label: 'CREATE' };
      case 'UPDATE':
        return { bg: '#DBEAFE', text: '#1E40AF', label: 'UPDATE' };
      case 'CHECKED':
      case 'VERIFY':
      case 'AUDIT':
        return { bg: '#EDE9FE', text: '#5B21B6', label: 'AUDIT' };
      case 'TRANSFER':
        return { bg: '#FEF3C7', text: '#B45309', label: 'TRANSFER' };
      case 'DELETE':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'DELETE' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: action || 'EVENT' };
    }
  };

  const getNodeIcon = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CREATE':
        return { icon: 'plus-box', library: 'community', bg: '#1E6B3A', color: '#FFFFFF' };
      case 'UPDATE':
        return { icon: 'checkbox-marked-outline', library: 'community', bg: '#DBEAFE', color: '#1E40AF' };
      case 'CHECKED':
      case 'VERIFY':
      case 'AUDIT':
        return { icon: 'clipboard-check-outline', library: 'community', bg: '#EDE9FE', color: '#5B21B6' };
      case 'TRANSFER':
        return { icon: 'swap-horizontal', library: 'community', bg: '#FEF3C7', color: '#B45309' };
      case 'DELETE':
        return { icon: 'trash-can-outline', library: 'community', bg: '#FEE2E2', color: '#DC2626' };
      default:
        return { icon: 'calendar-check', library: 'community', bg: '#F1F5F9', color: '#475569' };
    }
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1 && diffMs > 0) return 'לפני זמן קצר';
    if (diffHours === 1) return 'לפני שעה';
    if (diffHours === 2) return 'לפני שעתיים';
    if (diffHours > 2 && diffHours < 24) return `לפני ${diffHours} שעות`;

    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        
        {/* 1. Header: In RTL, Child 1 is on the RIGHT, Child 2 is on the LEFT */}
        <View style={styles.headerTop}>
          {/* Child 1 (RIGHT): Green Decagram Badge + Activity Timeline titles */}
          <View style={styles.headerTopRight}>
            <View style={styles.checkBadgeBox}>
              <MaterialCommunityIcons name="check-decagram" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerTitleColumn}>
              <Text style={styles.headerTopSubtitle}>
                {platoon ? `יומן פעילות • ${platoon}` : 'דו"ח ציוד טקטי • מחזור א\''}
              </Text>
              <Text style={styles.headerTopTitle}>
                {platoon ? 'Platoon Log' : 'Activity Timeline'}
              </Text>
            </View>
          </View>

          {/* Child 2 (LEFT): Close Button (X) + User Circle */}
          <View style={styles.headerTopLeft}>
            <TouchableOpacity testID="close-daily-summary" style={styles.iconBtnClose} onPress={onClose}>
              <Feather name="x" size={22} color="#DC2626" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.userCircleBtn}>
              <Feather name="user" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Content Container */}
        <ScrollView 
          style={styles.mainScroll} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* 2. Top Banner Card (ציר זמן יומי) */}
          <View style={styles.topBannerCard}>
            <View style={styles.topBannerHeader}>
              <View style={styles.topBannerTitleRow}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.topBannerTitle}>
                  {platoon ? `יומן אירועים - ${platoon}` : 'ציר זמן יומי'}
                </Text>
              </View>
              <View style={styles.liveSyncBadge}>
                <MaterialCommunityIcons name="broadcast" size={13} color="#4F46E5" />
                <Text style={styles.liveSyncText}>סנכרון מבצעי חי</Text>
              </View>
            </View>
          </View>

          {/* 3. Day Navigation Card */}
          <View style={styles.dateNavCard}>
            {/* In RTL: Right button is "הקודם" (Back into past), Left button is "הבא" (Forward) */}
            <TouchableOpacity 
              style={styles.navDayBtn} 
              onPress={() => navigateDay(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.navDayBtnText}>הקודם</Text>
              <Feather name="arrow-right" size={16} color="#1E293B" />
            </TouchableOpacity>

            <View style={styles.dateCenterColumn}>
              <View style={styles.dateTitleRow}>
                <Feather name="calendar" size={16} color="#15803D" />
                <Text style={styles.dateMainText}>{formatHebrewDate(currentDate)}</Text>
              </View>
              <Text style={styles.dateSubtitleText}>יומן אירועים פלוגתי</Text>
            </View>

            <TouchableOpacity 
              style={[styles.navDayBtn, isToday && styles.navDayBtnDisabled]} 
              onPress={() => navigateDay(1)}
              disabled={isToday}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={16} color={isToday ? '#94A3B8' : '#1E293B'} />
              <Text style={[styles.navDayBtnText, isToday && { color: '#94A3B8' }]}>הבא</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Filter Chips / Pills */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {/* In RTL, child 1 is on the RIGHT */}
            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <MaterialCommunityIcons 
                name="view-list" 
                size={14} 
                color={activeFilter === 'ALL' ? '#FFFFFF' : '#15803D'} 
              />
              <Text style={[styles.filterPillText, activeFilter === 'ALL' && styles.filterPillTextActive]}>
                הכל ({filterCounts.ALL})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'CREATE' && styles.filterPillActive]}
              onPress={() => setActiveFilter('CREATE')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#15803D' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'CREATE' && styles.filterPillTextActive]}>
                יצירה ({filterCounts.CREATE})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'UPDATE' && styles.filterPillActive]}
              onPress={() => setActiveFilter('UPDATE')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#2563EB' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'UPDATE' && styles.filterPillTextActive]}>
                עדכון ({filterCounts.UPDATE})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'TRANSFER' && styles.filterPillActive]}
              onPress={() => setActiveFilter('TRANSFER')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#D97706' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'TRANSFER' && styles.filterPillTextActive]}>
                העברה ({filterCounts.TRANSFER})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterPill, activeFilter === 'DELETE' && styles.filterPillActive]}
              onPress={() => setActiveFilter('DELETE')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.filterPillText, activeFilter === 'DELETE' && styles.filterPillTextActive]}>
                מחיקה ({filterCounts.DELETE})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* 5. Vertical Timeline Section */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1E6B3A" />
            </View>
          ) : filteredLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={40} color="#CBD5E1" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitleText}>
                {platoon ? `אין פעילויות שתועדו עבור ${platoon}` : 'אין פעילויות שתועדו ביום זה'}
              </Text>
              <Text style={styles.emptySubText}>
                {isToday 
                  ? (platoon ? `פעולות ואימותי ציוד של ${platoon} יופיעו כאן בזמן אמת` : 'פעולות חדשות שייקלטו במערכת יופיעו כאן בזמן אמת') 
                  : 'עבור ליום אחר בעזרת כפתורי הניווט'}
              </Text>
            </View>
          ) : (
            <View style={styles.timelineContainer}>
              {/* Continuous vertical timeline guide line on the RIGHT */}
              <View style={styles.timelineGuideLine} />

              {filteredLogs.map((log, index) => {
                const badge = getActionBadgeStyle(log.action);
                const node = getNodeIcon(log.action);
                const timeStr = log.timestamp?.toDate 
                  ? log.timestamp.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const relativeTime = formatRelativeTime(log.timestamp);

                return (
                  <View key={log.id || `${log.tsadiNumber || 'log'}-${log.action}-${index}`} style={styles.timelineRow}>
                    
                    {/* Right side in RTL: Node Box & Time */}
                    <View style={styles.timelineNodeCol}>
                      <View style={[styles.timelineNodeBox, { backgroundColor: node.bg }]}>
                        <MaterialCommunityIcons 
                          name={node.icon as any} 
                          size={18} 
                          color={node.color} 
                        />
                      </View>
                      <Text style={styles.timelineTimeText}>{timeStr}</Text>
                    </View>

                    {/* Left side in RTL: Event Card */}
                    <View style={styles.eventCard}>
                      
                      {/* Event Card Header */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.badgeGroup}>
                          <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.actionBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                          <View style={styles.userBadge}>
                            <Text style={styles.userBadgeText}>{log.user || 'משתמש'}</Text>
                          </View>
                        </View>
                        <Text style={styles.relativeTimeText}>{relativeTime || timeStr}</Text>
                      </View>

                      {/* Event Details Text */}
                      <Text style={styles.cardMainText}>
                        {log.tsadiNumber && log.tsadiNumber !== 'multiple' ? (
                          <Text style={styles.boldTsadiText}>{log.tsadiNumber} - </Text>
                        ) : null}
                        {log.details || 'ביצוע פעולה במערכת'}
                      </Text>

                      {/* Event Card Footer Tag */}
                      <View style={styles.cardFooterTagRow}>
                        {log.action?.toUpperCase() === 'CHECKED' || log.action?.toUpperCase() === 'AUDIT' ? (
                          <>
                            <Feather name="shield" size={12} color="#5B21B6" />
                            <Text style={styles.cardFooterTagText}>בדיקת תקינות • אישור פלוגתי</Text>
                          </>
                        ) : (
                          <>
                            <MaterialCommunityIcons name="qrcode-scan" size={13} color="#0284C7" />
                            <Text style={styles.cardFooterTagText}>
                              מק״ט: {log.tsadiNumber || 'טקטי'} • רישום ותאימות
                            </Text>
                          </>
                        )}
                      </View>
                    </View>

                  </View>
                );
              })}

              {/* Timeline Bottom Start Label */}
              <View style={styles.timelineBottomMark}>
                <View style={styles.timelineBottomDot} />
                <Text style={styles.timelineBottomText}>
                  תחילת רישום פעילות ליום {currentDate.getDate()}.{currentDate.getMonth() + 1}
                </Text>
                <Text style={styles.timelineBottomSub}>
                  כל הפריטים סונכרנו מול השרת הגדודי
                </Text>
              </View>

            </View>
          )}

        </ScrollView>

        {/* 6. Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={onClose}>
            <MaterialCommunityIcons name="archive-outline" size={22} color="#334155" />
            <Text style={styles.navText}>קשפ"ל</Text>
          </TouchableOpacity>

          {platoon ? (
            <TouchableOpacity style={styles.navItem} activeOpacity={1}>
              <Feather name="clipboard" size={20} color="#15803D" />
              <Text style={[styles.navText, styles.navTextActive]}>יומן אירועים</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.navItem} onPress={onClose}>
              <Feather name="plus-circle" size={20} color="#334155" />
              <Text style={styles.navText}>הוספת ציוד</Text>
            </TouchableOpacity>
          )}

          {platoon ? (
            <TouchableOpacity style={styles.navItem} onPress={onClose}>
              <Feather name="alert-triangle" size={20} color="#334155" />
              <Text style={styles.navText}>דיווח תקלה</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.navItem} activeOpacity={1}>
              <Feather name="clock" size={20} color="#15803D" />
              <Text style={[styles.navText, styles.navTextActive]}>ציר זמן</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.navItem} onPress={onClose}>
            <MaterialIcons name="badge" size={22} color="#334155" />
            <Text style={styles.navText}>כניסה</Text>
          </TouchableOpacity>
        </View>

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
    paddingTop: 4,
    paddingBottom: 24,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  /* Header Top */
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBadgeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    alignItems: 'flex-start', // In RTL, flex-start is the RIGHT edge
  },
  headerTopSubtitle: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
    fontWeight: '500',
  },
  headerTopTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  headerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnClose: {
    padding: 6,
  },
  userCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 2. Top Banner Card */
  topBannerCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E7FE',
  },
  topBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#15803D',
  },
  topBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    gap: 4,
  },
  liveSyncText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },

  /* 3. Day Navigation Card */
  dateNavCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  navDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  navDayBtnDisabled: {
    opacity: 0.5,
  },
  navDayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  dateCenterColumn: {
    alignItems: 'center',
  },
  dateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateMainText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* 4. Filter Pills */
  filterPillsRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: '#1E6B3A',
    borderColor: '#1E6B3A',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  /* 5. Timeline Layout */
  timelineContainer: {
    position: 'relative',
    paddingRight: 4,
    marginBottom: 20,
  },
  timelineGuideLine: {
    position: 'absolute',
    top: 18,
    bottom: 30,
    right: 23, // Aligned with the center of timelineNodeCol
    width: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    zIndex: 2,
  },
  timelineNodeCol: {
    width: 48,
    alignItems: 'center',
    marginLeft: 10,
    zIndex: 3,
  },
  timelineNodeBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
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
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  relativeTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 10,
    lineHeight: 20,
  },
  boldTsadiText: {
    fontWeight: '900',
    color: '#1E293B',
  },
  cardFooterTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  cardFooterTagText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },

  /* Bottom Timeline Marker */
  timelineBottomMark: {
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
  },
  timelineBottomDot: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  timelineBottomText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  timelineBottomSub: {
    fontSize: 10,
    color: '#334155',
    marginTop: 2,
    fontWeight: '500',
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },

  /* Bottom Navigation Bar */
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
  },
  navText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  navTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
});
