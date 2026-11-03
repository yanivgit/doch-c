import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TextInput, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Device, updateDeviceNotes } from '../firebase/api';
import { theme } from '../theme/theme';

interface EditNoteModalProps {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditNoteModal({ device, visible, onClose, onSaved }: EditNoteModalProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (device && visible) {
      setNote(device.notes || '');
    }
  }, [device, visible]);

  if (!device) return null;

  const handleSave = async () => {
    if (!device?.id) return;
    const deviceId = device.id;
    setLoading(true);
    try {
      await updateDeviceNotes(deviceId, note.trim());
      onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving note:", error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את ההערה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!device?.id) return;
    const deviceId = device.id;
    
    const confirmDelete = async () => {
      setLoading(true);
      try {
        await updateDeviceNotes(deviceId, '');
        onSaved();
        onClose();
      } catch (error) {
        console.error("Error clearing note:", error);
        Alert.alert('שגיאה', 'לא ניתן למחוק את ההערה.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('האם אתה בטוח שברצונך למחוק את ההערה?')) {
        await confirmDelete();
      }
      return;
    }

    Alert.alert(
      'מחיקת הערה',
      'האם למחוק את ההערה מהמכשיר?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: confirmDelete }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
            
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <View style={styles.headerIconCircle}>
                  <Feather name="file-text" size={18} color="#D97706" />
                </View>
                <Text style={styles.title}>הערת קשר"ג לציוד</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="סגור">
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Device Info */}
            <View style={styles.deviceInfoContainer}>
              <Text style={styles.deviceInfoText}>
                {device.type} • צ&apos;: {device.tsadiNumber}
              </Text>
              <Text style={styles.deviceInfoSubText}>
                שיוך: {device.assignment || 'ללא שיוך'}{device.location ? ` | מיקום: ${device.location}` : ''}
              </Text>
            </View>

            {/* Privacy notice banner */}
            <View style={styles.noticeBanner}>
              <Feather name="shield" size={14} color="#0284C7" style={{ marginLeft: 6 }} />
              <Text style={styles.noticeText}>
                הערה זו פנימית לקשר"ג בלבד. היא לא תוצג לקשפ"ל ולא תיכלל בהעתקת הדו"ח.
              </Text>
            </View>

            {/* Input area */}
            <View style={styles.inputSection}>
              <View style={styles.inputHeaderRow}>
                <Text style={styles.charCount}>{note.length}/500</Text>
                <Text style={styles.label}>תוכן ההערה</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={note}
                onChangeText={setNote}
                placeholder="הוסף הערה (למשל: במקור שייך לפלוגה ב, נמצא זמנית בפלוגה א)..."
                placeholderTextColor="#94A3B8"
                maxLength={500}
                multiline={true}
                numberOfLines={4}
                textAlign="right"
                textAlignVertical="top"
                autoFocus={true}
              />
            </View>

            {/* Action buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={[styles.saveButton, loading && styles.buttonDisabled]} 
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    <Text style={styles.saveButtonText}>שמור הערה</Text>
                  </>
                )}
              </TouchableOpacity>

              {device.notes ? (
                <TouchableOpacity 
                  style={[styles.deleteButton, loading && styles.buttonDisabled]} 
                  onPress={handleDeleteNote}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Feather name="trash-2" size={15} color="#DC2626" style={{ marginLeft: 6 }} />
                  <Text style={styles.deleteButtonText}>מחק הערה</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={onClose}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  deviceInfoContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deviceInfoText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  deviceInfoSubText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
  },
  noticeBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
    textAlign: 'right',
    lineHeight: 18,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  charCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 100,
  },
  actionsContainer: {
    gap: 10,
  },
  saveButton: {
    flexDirection: 'row-reverse',
    backgroundColor: '#15803D',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
