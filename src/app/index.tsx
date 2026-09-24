import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, UserRole } from '../context/AppContext';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { login } = useApp();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');

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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.topHeaderIcon}>
            <Feather name="log-out" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
          <Text style={styles.topHeaderText}>דו&quot;ח ציוד טקטי • מחזור א׳</Text>
          <TouchableOpacity style={styles.topHeaderIcon}>
            <Feather name="user" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Shield Banner */}
        <View style={styles.shieldContainer}>
          <View style={styles.shieldIconWrapper}>
            <Feather name="shield" size={32} color={theme.colors.success} />
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>רשת מבצעית פעילה</Text>
          </View>
        </View>
        
        {/* Main Titles */}
        <View style={styles.header}>
          <Text style={styles.title}>דו&quot;ח צ&apos;</Text>
          <Text style={styles.subtitle}>מערכת ניהול ציוד קשר ודיווח מבצעי</Text>
          <View style={styles.authNoteContainer}>
            <Feather name="check-circle" size={14} color={theme.colors.success} />
            <Text style={styles.authNoteText}>הזדהות לפי הרשאת תפקיד גזרתית</Text>
          </View>
        </View>

        <View style={styles.roleSelection}>
          <Text style={styles.instruction}>בחר תפקיד להתחברות:</Text>
          
          {/* Kashpal Card */}
          <TouchableOpacity style={styles.roleCardLight} onPress={() => handleRoleSelect('Kashpal')}>
            <View style={styles.roleCardLeft}>
              <Feather name="arrow-left" size={20} color={theme.colors.textMuted} />
            </View>
            <View style={styles.roleCardContent}>
              <Text style={styles.roleCardTitleLight}>קשפ&quot;ל</Text>
              <Text style={styles.roleCardDescLight}>תצוגת פלוגה | ניהול צק&quot;ח ומצאי שטח</Text>
            </View>
            <View style={[styles.roleCardIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Feather name="briefcase" size={24} color={theme.colors.success} />
            </View>
          </TouchableOpacity>

          {/* Kashrag Card */}
          <TouchableOpacity style={styles.roleCardDark} onPress={() => handleRoleSelect('Kashrag')}>
            <View style={styles.roleCardLeft}>
              <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.5)" />
            </View>
            <View style={styles.roleCardContent}>
              <Text style={styles.roleCardTitleDark}>קשר&quot;ג</Text>
              <Text style={styles.roleCardDescDark}>תצוגת גדוד | סנכרון תמונת מצב גדודית</Text>
            </View>
            <View style={[styles.roleCardIconWrapper, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
              <Feather name="command" size={24} color="#A7F3D0" />
            </View>
          </TouchableOpacity>
          
          {/* General Report Button */}
          <TouchableOpacity style={styles.generalReportButton} onPress={() => router.push('/report/submit')}>
            <Feather name="alert-triangle" size={18} color={theme.colors.warning} />
            <Text style={styles.generalReportText}>הגש דיווח כללי / תקלה</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>גרסת מערכת מבצעית v2.4 — אגף קשר ואלקטרוניקה</Text>
          </View>
          <Text style={styles.footerSubtext}>סיווג: מוגבל | מיועד לשימוש מורשה בלבד</Text>
        </View>

        {/* Bottom Navigation Mock */}
        <View style={styles.bottomNav}>
          <View style={styles.navItem}>
            <Feather name="briefcase" size={20} color={theme.colors.textMuted} />
            <Text style={styles.navText}>קשפ"ל</Text>
          </View>
          <View style={styles.navItem}>
            <Feather name="plus-circle" size={20} color={theme.colors.textMuted} />
            <Text style={styles.navText}>הוספת ציוד</Text>
          </View>
          <View style={styles.navItem}>
            <Feather name="clock" size={20} color={theme.colors.textMuted} />
            <Text style={styles.navText}>ציר זמן</Text>
          </View>
          <View style={styles.navItem}>
            <Feather name="shield" size={20} color={theme.colors.primary} />
            <Text style={[styles.navText, {color: theme.colors.primary, fontWeight: '700'}]}>כניסה</Text>
          </View>
        </View>

      </ScrollView>

      <Modal visible={showPinModal} animationType="fade" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>הכנס קוד קשר&quot;ג</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              placeholder="****"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => { setShowPinModal(false); setPin(''); }}>
                <Text style={styles.modalButtonTextCancel}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonSubmit} onPress={handlePinSubmit}>
                <Text style={styles.modalButtonTextSubmit}>היכנס</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean white background like the design
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  topHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  topHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  shieldContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shieldIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    marginLeft: 8,
  },
  statusText: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.primary,
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 16,
  },
  authNoteContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  authNoteText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  roleSelection: {
    width: '100%',
    marginBottom: 40,
  },
  instruction: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'right',
    color: theme.colors.text,
    fontWeight: '800',
  },
  roleCardLight: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  roleCardDark: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  roleCardLeft: {
    width: 40,
    alignItems: 'center',
  },
  roleCardContent: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  roleCardIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitleLight: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 2,
  },
  roleCardDescLight: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  roleCardTitleDark: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  roleCardDescDark: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  generalReportButton: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generalReportText: {
    color: theme.colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...theme.elevation.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
  },
  pinInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    width: '100%',
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 10,
  },
  modalButtons: {
    flexDirection: 'row-reverse',
    width: '100%',
    justifyContent: 'space-between',
  },
  modalButtonCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    marginLeft: 10,
  },
  modalButtonSubmit: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
