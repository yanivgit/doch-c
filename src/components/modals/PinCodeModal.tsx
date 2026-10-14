import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  StyleSheet 
} from 'react-native';

interface PinCodeModalProps {
  visible: boolean;
  pin: string;
  onChangePin: (pin: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function PinCodeModal({
  visible,
  pin,
  onChangePin,
  onSubmit,
  onCancel
}: PinCodeModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
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
            onChangeText={onChangePin}
            placeholder="****"
            placeholderTextColor="#94A3B8"
            autoFocus
            maxLength={6}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.modalButtonCancel} 
              onPress={onCancel}
            >
              <Text style={styles.modalButtonTextCancel}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalButtonSubmit} 
              onPress={onSubmit}
            >
              <Text style={styles.modalButtonTextSubmit}>היכנס</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
