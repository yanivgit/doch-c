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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, UserRole } from '../context/AppContext';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import PinCodeModal from '../components/modals/PinCodeModal';

export default function RoleSelectionScreen() {
  const { login } = useApp();
  const [showPinModal, setShowPinModal] = useState(false);
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

      {/* PIN Code Verification Modal */}
      <PinCodeModal
        visible={showPinModal}
        pin={pin}
        onChangePin={setPin}
        onSubmit={handlePinSubmit}
        onCancel={() => { setShowPinModal(false); setPin(''); }}
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
    paddingBottom: 32,
  },

  /* Tactical Status Bar */
  tacticalStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  securitySealText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  onlineBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  beaconText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Hero Section */
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroSymbolContainer: {
    marginBottom: 12,
  },
  heroSymbolOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#15803D',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
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
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  heroDivider: {
    width: 48,
    height: 3,
    backgroundColor: '#15803D',
    borderRadius: 2,
    marginTop: 14,
  },

  /* Console Selection Section */
  consoleSection: {
    marginTop: 8,
    gap: 14,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  consolePromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  consoleScopeBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  /* Kashrag Card (Dark Tactical Command Deck) */
  kashragCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kashragBadge: {
    backgroundColor: 'rgba(21, 128, 61, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  kashragBadgeText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '800',
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
    fontWeight: '500',
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
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
    alignItems: 'flex-start',
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

  /* Kashpal Card (Clean Tactical Field Unit) */
  kashpalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
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
});
