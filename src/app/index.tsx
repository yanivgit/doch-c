import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  Animated 
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, UserRole } from '../context/AppContext';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import ReportFaultModal from '../components/ReportFaultModal';
import PinCodeModal from '../components/modals/PinCodeModal';
import { theme } from '../theme/theme';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { login } = useApp();
  const [showPinModal, setShowPinModal] = useState(false);
  const [showReportFaultModal, setShowReportFaultModal] = useState(false);
  const [pin, setPin] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const handleRoleSelect = (role: UserRole) => {
    if (role === 'Kashrag') {
      setShowPinModal(true);
    } else {
      login(role);
    }
  };

  const handlePinSubmit = () => {
    if (pin === '1379') {
      setShowPinModal(false);
      setPin('');
      login('Kashrag');
    } else {
      Alert.alert('שגיאה', 'קוד PIN שגוי');
      setPin('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Tactical Status Bar */}
        <View style={styles.tacticalStatusBar}>
          <View style={styles.securitySeal}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#15803D" />
            <Text style={styles.securitySealText}>מאובטח צה״ל • מוצפן</Text>
          </View>
          <View style={styles.onlineBeacon}>
            <Animated.View style={[styles.beaconDot, { opacity: pulseAnim }]} />
            <Text style={styles.beaconText}>רשת מבצעית פעילה</Text>
          </View>
        </View>

        {/* Hero Command Header */}
        <View style={styles.heroSection}>
          <View style={styles.heroSymbolContainer}>
            <View style={styles.heroSymbolOuter}>
              <MaterialCommunityIcons name="radio-tower" size={32} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.heroMainTitle}>דו״ח צ׳ מבצעי</Text>
          <Text style={styles.heroSubtitle}>מערכת שליטה במצבת קשר ואמצעי לחימה</Text>
          <View style={styles.heroDivider} />
        </View>

        {/* Role Selection Console */}
        <View style={styles.consoleSection}>
          <View style={styles.consoleHeader}>
            <Text style={styles.consolePromptText}>בחר עמדת דיווח:</Text>
            <Text style={styles.consoleScopeBadge}>מחזור פעיל</Text>
          </View>

          {/* Kashrag Command Card (Primary Tactical Console) */}
          <TouchableOpacity 
            style={styles.kashragCard} 
            activeOpacity={0.88} 
            onPress={() => handleRoleSelect('Kashrag')}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.kashragBadge}>
                <Text style={styles.kashragBadgeText}>מפקדת הגדוד</Text>
              </View>
              <View style={styles.pinRequiredIndicator}>
                <Feather name="lock" size={13} color="#94A3B8" />
                <Text style={styles.pinRequiredText}>קוד גישה</Text>
              </View>
            </View>

            <View style={styles.cardMainRow}>
              <View style={styles.kashragIconBox}>
                <MaterialIcons name="hub" size={28} color="#4ADE80" />
              </View>
              <View style={styles.cardTextContent}>
                <Text style={styles.kashragTitle}>קשר"ג</Text>
                <Text style={styles.kashragSub}>תצוגת גדוד מלאה • אימות דוח צ', פתיחת סבב וניהול צק"ח</Text>
              </View>
              <View style={styles.actionArrowKashrag}>
                <Feather name="arrow-left" size={20} color="#4ADE80" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Kashpal Field Card (Field Operations Unit) */}
          <TouchableOpacity 
            style={styles.kashpalCard} 
            activeOpacity={0.88} 
            onPress={() => handleRoleSelect('Kashpal')}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.kashpalBadge}>
                <Text style={styles.kashpalBadgeText}>דרג שטח</Text>
              </View>
              <View style={styles.directAccessIndicator}>
                <Feather name="check-circle" size={13} color="#15803D" />
                <Text style={styles.directAccessText}>כניסה מהירה</Text>
              </View>
            </View>

            <View style={styles.cardMainRow}>
              <View style={styles.kashpalIconBox}>
                <MaterialIcons name="radio" size={28} color="#15803D" />
              </View>
              <View style={styles.cardTextContent}>
                <Text style={styles.kashpalTitle}>קשפ"ל</Text>
                <Text style={styles.kashpalSub}>תצוגת פלוגה • ספירת שטח, דיווח כשירות ואימות ציוד</Text>
              </View>
              <View style={styles.actionArrowKashpal}>
                <Feather name="arrow-left" size={20} color="#475569" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Direct Incident / Fault Action Tile */}
          <TouchableOpacity 
            style={styles.faultReportTile} 
            activeOpacity={0.85} 
            onPress={() => setShowReportFaultModal(true)}
          >
            <View style={styles.faultTileInner}>
              <View style={styles.faultIconBox}>
                <Feather name="alert-triangle" size={18} color="#B45309" />
              </View>
              <View style={styles.faultTextGroup}>
                <Text style={styles.faultTileTitle}>דיווח תקלה במכשיר קשר</Text>
                <Text style={styles.faultTileSub}>דיווח ישיר לקשר״ג ללא תהליך כניסה מלא</Text>
              </View>
              <Feather name="chevron-left" size={18} color="#B45309" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Operational Terminal Footer */}
        <View style={styles.terminalFooter}>
          <View style={styles.footerSpecsRow}>
            <View style={styles.terminalLiveDot} />
            <Text style={styles.footerSpecsText}>גרסה מבצעית 2.4 • ענף קשר ואלקטרוניקה</Text>
          </View>
          <Text style={styles.footerClassifiedText}>סיווג מוגבל | לשימוש בעלי תפקיד מורשים בלבד</Text>
        </View>
      </ScrollView>

      {/* Floating Tactical Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => handleRoleSelect('Kashpal')}>
          <MaterialCommunityIcons name="archive-outline" size={22} color="#64748B" />
          <Text style={styles.navText}>קשפ"ל</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleRoleSelect('Kashrag')}>
          <Feather name="plus-circle" size={20} color="#64748B" />
          <Text style={styles.navText}>הוספת ציוד</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => Alert.alert('ציר זמן', 'התחבר תחילה כדי לצפות בציר הזמן המבצעי')}>
          <Feather name="clock" size={20} color="#64748B" />
          <Text style={styles.navText}>ציר זמן</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, styles.navItemActive]} activeOpacity={1}>
          <MaterialIcons name="badge" size={22} color="#15803D" />
          <Text style={[styles.navText, styles.navTextActive]}>כניסה</Text>
        </TouchableOpacity>
      </View>

      {/* PIN Code Verification Modal */}
      <PinCodeModal
        visible={showPinModal}
        pin={pin}
        onChangePin={setPin}
        onSubmit={handlePinSubmit}
        onCancel={() => { setShowPinModal(false); setPin(''); }}
      />

      {/* Report Fault Modal */}
      <ReportFaultModal
        visible={showReportFaultModal}
        onClose={() => setShowReportFaultModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 100,
  },

  /* Tactical Status Bar */
  tacticalStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 20,
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  securitySealText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  onlineBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  beaconText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  /* Hero Section */
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  heroSymbolContainer: {
    marginBottom: 14,
  },
  heroSymbolOuter: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  heroMainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },
  heroDivider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#15803D',
    marginTop: 14,
  },

  /* Console Section */
  consoleSection: {
    gap: 14,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  consolePromptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  consoleScopeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  /* Kashrag Card (Dark Tactical Command Center) */
  kashragCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kashragBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kashragBadgeText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pinRequiredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinRequiredText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  kashragIconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
  },
  kashragTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  kashragSub: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    lineHeight: 17,
  },
  actionArrowKashrag: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },

  /* Kashpal Card (Crisp Tactical Surface) */
  kashpalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  kashpalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kashpalBadgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  directAccessIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  directAccessText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '600',
  },
  kashpalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kashpalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  kashpalSub: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    lineHeight: 17,
  },
  actionArrowKashpal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  /* Fault Report Tile */
  faultReportTile: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 14,
    marginTop: 4,
  },
  faultTileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  faultIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faultTextGroup: {
    flex: 1,
  },
  faultTileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  faultTileSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B45309',
  },

  /* Terminal Footer */
  terminalFooter: {
    marginTop: 32,
    alignItems: 'center',
    gap: 4,
  },
  footerSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  terminalLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  footerSpecsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  footerClassifiedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },

  /* Bottom Navigation */
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#15803D',
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  navTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
});
