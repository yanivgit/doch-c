import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Animated 
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, UserRole } from '../context/AppContext';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import ReportFaultModal from '../components/ReportFaultModal';

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
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
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
        
        {/* Top Header Row: In RTL (flex-direction: row), Child 1 is on the RIGHT, Child 2 is on the LEFT */}
        <View style={styles.headerTop}>
          {/* Child 1 (RIGHT): Green verified badge on far right, then Titles column */}
          <View style={styles.headerTopRight}>
            <View style={styles.checkBadgeBox}>
              <MaterialCommunityIcons name="check-decagram" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerTitleColumn}>
              <Text style={styles.headerTopSubtitle}>דו"ח ציוד טקטי • מחזור א'</Text>
              <Text style={styles.headerTopTitle}>Login Roles</Text>
            </View>
          </View>

          {/* Child 2 (LEFT): Red logout toward inside, Green user circle at the far left edge */}
          <View style={styles.headerTopLeft}>
            <TouchableOpacity style={styles.iconBtnLogout} onPress={() => Alert.alert('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', [{ text: 'ביטול', style: 'cancel' }, { text: 'התנתק', style: 'destructive' }])}>
              <Feather name="log-out" size={20} color="#DC2626" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.userCircleBtn}>
              <Feather name="user" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating Settings Gear Icon on the top left */}
        <View style={styles.settingsRow}>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => Alert.alert('הגדרות', 'מערכת ניהול דוח צ v2.4')}>
            <Feather name="settings" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Shield Banner (Lavender / Light Indigo Card) */}
        <View style={styles.bannerContainer}>
          <Text style={styles.bannerSmallText}>דו'ח צ</Text>
          <View style={styles.shieldWhiteCard}>
            <MaterialCommunityIcons name="shield-check" size={34} color="#15803D" />
          </View>
          <View style={styles.statusPill}>
            <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
            <Text style={styles.statusText}>רשת מבצעית פעילה</Text>
          </View>
        </View>

        {/* Main Titles */}
        <View style={styles.titlesSection}>
          <Text style={styles.mainTitle}>דו"ח צ'</Text>
          <Text style={styles.mainSubtitle}>מערכת ניהול ציוד קשר ודיווח מבצעי</Text>
          <View style={styles.authBadgePill}>
            <MaterialCommunityIcons name="shield-check-outline" size={15} color="#15803D" />
            <Text style={styles.authBadgeText}>הזדהות לפי הרשאת תפקיד גזרתית</Text>
          </View>
        </View>

        {/* Roles Section */}
        <View style={styles.rolesSection}>
          <View style={styles.instructionRow}>
            {/* Child 1 in RTL: On the RIGHT */}
            <Text style={styles.instructionText}>בחר תפקיד להתחברות:</Text>
            {/* Child 2 in RTL: On the LEFT */}
            <View style={styles.idfBadge}>
              <Text style={styles.idfBadgeText}>מאובטח צה"ל</Text>
            </View>
          </View>

          {/* Kashpal Button: Light Card (Child 1: Mint Icon Box, Child 2: Text Column, Child 3: Arrow Circle) */}
          <TouchableOpacity 
            style={styles.roleCardLight} 
            activeOpacity={0.85} 
            onPress={() => handleRoleSelect('Kashpal')}
          >
            <View style={styles.kashpalIconBox}>
              <MaterialIcons name="radio" size={26} color="#15803D" />
            </View>
            <View style={styles.roleCardContent}>
              <Text style={styles.roleTitleLight}>קשפ"ל</Text>
              <Text style={styles.roleSubLight}>תצוגת פלוגה • ניהול צק"ח ומצאי שטח</Text>
            </View>
            <View style={styles.roleCardLeftArrowLight}>
              <Feather name="arrow-left" size={18} color="#475569" />
            </View>
          </TouchableOpacity>

          {/* Kashrag Button: Dark Navy Card (Child 1: Dark Slate Icon Box, Child 2: Text Column, Child 3: Arrow Circle) */}
          <TouchableOpacity 
            style={styles.roleCardDark} 
            activeOpacity={0.85} 
            onPress={() => handleRoleSelect('Kashrag')}
          >
            <View style={styles.kashragIconBox}>
              <MaterialIcons name="hub" size={26} color="#86EFAC" />
            </View>
            <View style={styles.roleCardContent}>
              <Text style={styles.roleTitleDark}>קשר"ג</Text>
              <Text style={styles.roleSubDark}>תצוגת גדוד • סנכרון תמונת מצב גדודית</Text>
            </View>
            <View style={styles.roleCardLeftArrowDark}>
              <Feather name="arrow-left" size={18} color="#E2E8F0" />
            </View>
          </TouchableOpacity>

          {/* General Report Button (Lavender / Indigo tint) */}
          <TouchableOpacity 
            style={styles.generalReportBtn} 
            activeOpacity={0.85} 
            onPress={() => setShowReportFaultModal(true)}
          >
            <View style={styles.generalReportInner}>
              <Feather name="alert-triangle" size={18} color="#B45309" style={{ marginLeft: 8 }} />
              <Text style={styles.generalReportText}>הגש דיווח כללי / תקלה</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerTopRow}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>גרסת מערכת מבצעית v2.4 • ענף קשר ואלקטרוניקה</Text>
          </View>
          <Text style={styles.footerSubText}>סיווג: מוגבל | מיועד לשימוש מורשה בלבד</Text>
        </View>

      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* In RTL: Child 1 is far right, Child 4 is far left */}
        <TouchableOpacity style={styles.navItem} onPress={() => handleRoleSelect('Kashpal')}>
          <MaterialCommunityIcons name="archive-outline" size={22} color="#64748B" />
          <Text style={styles.navText}>קשפ"ל</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleRoleSelect('Kashrag')}>
          <Feather name="plus-circle" size={20} color="#64748B" />
          <Text style={styles.navText}>הוספת ציוד</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => Alert.alert('ציר זמן', 'התחבר תחילה כדי לצפות בציר הזמן')}>
          <Feather name="clock" size={20} color="#64748B" />
          <Text style={styles.navText}>ציר זמן</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} activeOpacity={1}>
          <MaterialIcons name="badge" size={22} color="#15803D" />
          <Text style={[styles.navText, styles.navTextActive]}>כניסה</Text>
        </TouchableOpacity>
      </View>

      {/* PIN Modal for Kashrag */}
      <Modal visible={showPinModal} animationType="fade" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>הכנס קוד קשר"ג</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              placeholder="****"
              placeholderTextColor="#94A3B8"
              autoFocus
              maxLength={6}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonCancel} 
                onPress={() => { setShowPinModal(false); setPin(''); }}
              >
                <Text style={styles.modalButtonTextCancel}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButtonSubmit} 
                onPress={handlePinSubmit}
              >
                <Text style={styles.modalButtonTextSubmit}>היכנס</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  /* Header */
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBadgeBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E6B3A', // Solid tactical green with rounded corners
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    alignItems: 'flex-start', // in RTL, flex-start is the RIGHT edge!
  },
  headerTopSubtitle: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
    fontWeight: '500',
  },
  headerTopTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  headerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnLogout: {
    padding: 6,
  },
  userCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E6B3A', // Dark green avatar
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Floating Settings gear icon on the top left */
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // in RTL, flex-end places it on the LEFT edge!
    marginTop: -2,
    marginBottom: 8,
  },
  settingsBtn: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  /* Shield Banner (Lavender / Indigo Card) */
  bannerContainer: {
    backgroundColor: '#EEF2FF', // Soft lavender / indigo card
    borderRadius: 24,
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerSmallText: {
    fontSize: 12,
    color: '#818CF8', // Light indigo / purple text
    fontWeight: '700',
    marginBottom: 10,
  },
  shieldWhiteCard: {
    width: 60,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7', // Mint green pill
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#15803D',
    marginLeft: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Main Titles */
  titlesSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  mainSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  authBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF', // Soft indigo background
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 6,
  },
  authBadgeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },

  /* Roles Section */
  rolesSection: {
    marginBottom: 24,
  },
  instructionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  idfBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  idfBadgeText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700',
  },

  /* Role Card 1: Kashpal (Light) */
  roleCardLight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  kashpalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#BBF7D0', // Mint green background
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardContent: {
    flex: 1,
    paddingHorizontal: 14,
    alignItems: 'flex-start', // in RTL, flex-start is the RIGHT edge!
  },
  roleTitleLight: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  roleSubLight: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  roleCardLeftArrowLight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Role Card 2: Kashrag (Dark) */
  roleCardDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2538', // Dark technical navy slate
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  kashragIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitleDark: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  roleSubDark: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 2,
  },
  roleCardLeftArrowDark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* General Report Button (Lavender / Indigo tint) */
  generalReportBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  generalReportInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generalReportText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  footerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
  },
  footerSubText: {
    fontSize: 10,
    color: '#94A3B8',
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
    color: '#64748B',
    fontWeight: '500',
  },
  navTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },

  /* PIN Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 20,
  },
  pinInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    width: '100%',
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 10,
    color: '#0F172A',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
  },
  modalButtonSubmit: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#15803D',
    borderRadius: 9999,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: 'bold',
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
