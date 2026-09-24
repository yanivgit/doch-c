import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import SearchableDropdown from './SearchableDropdown';
import { addDevice } from '../firebase/api';
import { useApp } from '../context/AppContext';
import { theme } from '../theme/theme';

interface AddDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddDeviceModal({ visible, onClose, onAdded }: AddDeviceModalProps) {
  const { getAllEquipmentTypes, getAllPlatoons, getLocationsForPlatoon, learnNewOption, selectedDohId } = useApp();
  const [equipmentType, setEquipmentType] = useState('');
  const [tzadeNumber, setTzadeNumber] = useState('');
  const [pluga, setPluga] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = equipmentType.trim() !== '' && tzadeNumber.trim() !== '';

  const handleSubmit = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      const newDeviceData = {
        type: equipmentType,
        tsadiNumber: tzadeNumber,
        assignment: pluga.trim() || 'מחלקת קשר',
        location: location.trim(),
        dohId: selectedDohId || ''
      };

      await addDevice(newDeviceData);
      
      // Learn new options
      learnNewOption('equipment', equipmentType);
      learnNewOption('platoon', pluga.trim() || 'מחלקת קשר');
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim() || 'מחלקת קשר');
      }
      
      Alert.alert('הצלחה', 'הציוד נוסף בהצלחה למאגר');
      
      // Reset form
      setEquipmentType('');
      setTzadeNumber('');
      setPluga('');
      setLocation('');
      onAdded();
      onClose();
    } catch (error: any) {
      console.error(error);
      if (error.message === 'DUPLICATE_TSADI') {
        Alert.alert('שגיאה', 'מספר צ\' זה כבר קיים בפלוגה זו.');
      } else {
        Alert.alert('שגיאה', 'שגיאה בהוספת הציוד');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView 
            keyboardShouldPersistTaps="handled" 
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View style={styles.header}>
              <Text style={styles.title}>הוספת ציוד חדש</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>סוג ציוד (חובה)</Text>
            <SearchableDropdown
              data={getAllEquipmentTypes()}
              value={equipmentType}
              onSelect={setEquipmentType}
              placeholder="חפש ובחר סוג ציוד..."
            />

            <Text style={styles.label}>מספר צ / מזהה (חובה)</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן מספר צ'"
              value={tzadeNumber}
              onChangeText={setTzadeNumber}
              keyboardType="numeric"
            />

            <Text style={styles.label}>שיוך לפלוגה (ברירת מחדל: מחלקת קשר)</Text>
            <SearchableDropdown
              data={getAllPlatoons()}
              value={pluga}
              onSelect={setPluga}
              placeholder="חפש ובחר פלוגה..."
            />

            <Text style={styles.label}>מיקום / תפקיד (אופציונלי)</Text>
            <SearchableDropdown
              data={getLocationsForPlatoon(pluga.trim() || 'מחלקת קשר')}
              value={location}
              onSelect={setLocation}
              placeholder="בחר או הקלד מיקום..."
              allowFreeText={true}
            />

            <TouchableOpacity 
              style={[styles.button, (!isValid || loading) && styles.buttonDisabled]} 
              onPress={handleSubmit}
              disabled={!isValid || loading}
            >
              <Text style={styles.buttonText}>{loading ? 'שומר...' : 'הוסף ציוד'}</Text>
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'right',
    color: theme.colors.text,
    fontWeight: '800',
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    textAlign: 'right',
  },
  button: {
    backgroundColor: theme.colors.success,
    paddingVertical: 18,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
