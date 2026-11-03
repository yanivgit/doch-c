import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import SearchableDropdown from './SearchableDropdown';
import { updateDeviceAssignmentAndLocation, Device } from '../firebase/api';
import { useApp } from '../context/AppContext';
import { theme } from '../theme/theme';

interface TransferDeviceModalProps {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
  onTransfer: () => void;
}

export default function TransferDeviceModal({ device, visible, onClose, onTransfer }: TransferDeviceModalProps) {
  const { userRole, selectedPlatoon, getAllPlatoons, getLocationsForPlatoon, learnNewOption } = useApp();
  const [pluga, setPluga] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [transferLinked, setTransferLinked] = useState(true);
  const [loading, setLoading] = useState(false);

  // Set initial platoon and location
  useEffect(() => {
    if (device && visible) {
      setPluga(device.assignment || '');
      setLocation(device.location || '');
      setNotes(device.notes || '');
      setTransferLinked(true);
    }
  }, [device, visible]);

  if (!device) return null;

  const isValid = pluga.trim() !== '';

  const handleSubmit = async () => {
    if (!isValid || !device.id) return;

    setLoading(true);
    try {
      const currentUser = userRole === 'Kashpal' 
        ? (selectedPlatoon ? `קשפ"ל_${selectedPlatoon}` : 'קשפ"ל')
        : 'קשר"ג';

      const notesToSave = userRole === 'Kashrag' ? notes.trim() : undefined;
      await updateDeviceAssignmentAndLocation(device.id, pluga, location.trim(), currentUser, notesToSave);
      
      // If user chose to transfer the linked paired media/host as well
      if (transferLinked && device.linkedDeviceId) {
        try {
          await updateDeviceAssignmentAndLocation(device.linkedDeviceId, pluga, location.trim(), currentUser);
        } catch (e) {
          console.error("Error transferring linked device:", e);
        }
      }
      
      // Learn new options
      learnNewOption('platoon', pluga.trim());
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim());
      }

      Alert.alert('הצלחה', 'הציוד הועבר בהצלחה');
      onTransfer();
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('שגיאה', 'שגיאה בהעברת הציוד');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.header}>
              <Text style={styles.title}>העברת ציוד</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.deviceInfoContainer}>
              <Text style={styles.deviceInfoText}>
                {device.type} - צ&apos;: {device.tsadiNumber}
              </Text>
              <Text style={styles.deviceInfoSubText}>
                שיוך נוכחי: {device.assignment || 'ללא שיוך'}{device.location ? ` | ${device.location}` : ''}
              </Text>
            </View>

            <Text style={styles.label}>בחר שיוך חדש</Text>
            <SearchableDropdown
              data={getAllPlatoons()}
              value={pluga}
              onSelect={(newPlatoon) => {
                const clean = newPlatoon.trim();
                setPluga(clean);
                if (clean && clean !== 'ללא שיוך') {
                  learnNewOption('platoon', clean);
                }
                setLocation(''); // Immediately clear location state when destination platoon changes
              }}
              placeholder="חפש או הקלד פלוגה חדשה..."
              allowFreeText={true}
            />

            <Text style={styles.label}>בחר או הקלד מיקום חדש (אופציונלי)</Text>
            <SearchableDropdown
              data={getLocationsForPlatoon(pluga.trim() || 'ללא שיוך')}
              value={location}
              onSelect={setLocation}
              placeholder="בחר מיקום..."
              allowFreeText={true}
            />

            {userRole === 'Kashrag' && (
              <View style={styles.notesContainer}>
                <View style={styles.notesHeaderRow}>
                  <Text style={styles.notesBadge}>קשר"ג בלבד</Text>
                  <Text style={styles.label}>הערה לציוד (אופציונלי)</Text>
                </View>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="הוסף הערה (למשל: במקור פלוגה ב)..."
                  placeholderTextColor="#94A3B8"
                  maxLength={500}
                  multiline={true}
                  numberOfLines={2}
                  textAlign="right"
                />
              </View>
            )}

            {device.linkedTsadi ? (
              <TouchableOpacity 
                style={styles.transferLinkedOption}
                onPress={() => setTransferLinked(prev => !prev)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkboxSquare, transferLinked && styles.checkboxSquareSelected]}>
                  {transferLinked && <Text style={styles.checkmarkText}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.transferLinkedTitle}>
                    העבר יחד את {device.linkedType || 'המדיה'} המקושרת (צ׳ {device.linkedTsadi})
                  </Text>
                  <Text style={styles.transferLinkedSub}>
                    הפריט המקושר יועבר אוטומטית לאותה פלוגה ומיקום
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity 
              style={[styles.button, (!isValid || loading) && styles.buttonDisabled]} 
              onPress={handleSubmit}
              disabled={!isValid || loading}
            >
              <Text style={styles.buttonText}>{loading ? 'שומר...' : 'העבר ציוד'}</Text>
            </TouchableOpacity>
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
    maxHeight: '80%',
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
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  deviceInfoContainer: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deviceInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'right',
  },
  deviceInfoSubText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'right',
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  notesContainer: {
    marginTop: 6,
    marginBottom: 12,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notesBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  notesInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 50,
  },
  transferLinkedOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0284C7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareSelected: {
    backgroundColor: '#0284C7',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  transferLinkedTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0369A1',
    textAlign: 'right',
  },
  transferLinkedSub: {
    fontSize: 12,
    color: '#0284C7',
    textAlign: 'right',
    marginTop: 2,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
