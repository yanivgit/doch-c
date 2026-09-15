import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import SearchableDropdown from './SearchableDropdown';
import { Device, updateDeviceLocation } from '../firebase/api';
import { useApp } from '../context/AppContext';
import { theme } from '../theme/theme';

interface EditLocationModalProps {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditLocationModal({ device, visible, onClose, onUpdate }: EditLocationModalProps) {
  const { getLocationsForPlatoon, learnNewOption } = useApp();
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (device && visible) {
      setLocation(device.location || '');
    }
  }, [device, visible]);

  if (!device) return null;

  const handleSubmit = async () => {
    if (!device.id) return;

    setLoading(true);
    try {
      await updateDeviceLocation(device.id, location.trim());
      
      // Learn new option
      if (location.trim()) {
        learnNewOption('location', location.trim(), device.assignment || 'ללא שיוך');
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('שגיאה', 'שגיאה בעדכון המיקום');
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
              <Text style={styles.title}>עדכון מיקום ציוד</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.deviceInfoContainer}>
              <Text style={styles.deviceInfoText}>
                {device.type} - צ&apos;: {device.tsadiNumber}
              </Text>
              <Text style={styles.deviceInfoSubText}>
                {device.assignment || 'ללא שיוך'}
              </Text>
            </View>

            <Text style={styles.label}>בחר או הקלד מיקום חדש</Text>
            <SearchableDropdown
              data={getLocationsForPlatoon(device.assignment || 'ללא שיוך')}
              value={location}
              onSelect={setLocation}
              placeholder="בחר מיקום..."
              allowFreeText={true}
            />

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'שומר...' : 'עדכן מיקום'}</Text>
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
