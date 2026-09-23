import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, UserRole } from '../context/AppContext';
import { theme } from '../theme/theme';

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
      <View style={styles.header}>
        <Text style={styles.title}>דו&quot;ח צ</Text>
        <Text style={styles.subtitle}>מערכת ניהול ציוד קשר</Text>
      </View>
      
      {/* Vercel Sync Indicator */}
      <View style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#F97316', // Orange
      }} />

      <View style={styles.roleSelection}>
        <Text style={styles.instruction}>בחר תפקיד להתחברות:</Text>
        
        <TouchableOpacity style={styles.button} onPress={() => handleRoleSelect('Kashpal')}>
          <Text style={styles.buttonText}>קשפ&quot;ל (תצוגת פלוגה)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={() => handleRoleSelect('Kashrag')}>
          <Text style={styles.buttonTextPrimary}>קשר&quot;ג (תצוגת גדוד)</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, { borderColor: theme.colors.accent, marginTop: 20 }]} onPress={() => router.push('/report/submit')}>
          <Text style={[styles.buttonText, { color: theme.colors.accent }]}>הגש דיווח כללי / תקלה</Text>
        </TouchableOpacity>
      </View>

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
    backgroundColor: theme.colors.background,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 52,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 10,
    textShadowColor: 'rgba(67, 56, 202, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  roleSelection: {
    width: '100%',
  },
  instruction: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  buttonText: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
    borderRadius: theme.borderRadius.md,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
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
    borderRadius: theme.borderRadius.sm,
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
    borderRadius: theme.borderRadius.sm,
    marginLeft: 10,
  },
  modalButtonSubmit: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
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
