import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  const { getAllPlatoons, getLocationsForPlatoon, learnNewOption } = useApp();
  const [pluga, setPluga] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  // Set initial platoon and location
  useEffect(() => {
    if (device && visible) {
      setPluga(device.assignment || '');
      setLocation(device.location || '');
    }
  }, [device, visible]);

  if (!device) return null;

  const isValid = pluga.trim() !== '';

  const handleSubmit = async () => {
    if (!isValid || !device.id) return;

    setLoading(true);
    try {
      await updateDeviceAssignmentAndLocation(device.id, pluga, location.trim());
      
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
              onSelect={setPluga}
              placeholder="חפש ובחר פלוגה..."
            />

            <Text style={styles.label}>בחר או הקלד מיקום חדש (אופציונלי)</Text>
            <SearchableDropdown
              data={getLocationsForPlatoon(pluga.trim() || 'ללא שיוך')}
              value={location}
              onSelect={setLocation}
              placeholder="בחר מיקום..."
              allowFreeText={true}
            />

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
