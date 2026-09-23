import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { addDevice, Device } from '../../../firebase/api';
import SearchableDropdown from '../../../components/SearchableDropdown';
import { theme } from '../../../theme/theme';

export default function RapidSetupScreen() {
  const router = useRouter();
  const { selectedDohId, selectedDohName, getAllEquipmentTypes, getAllPlatoons, getLocationsForPlatoon, learnNewOption } = useApp();

  const [equipmentType, setEquipmentType] = useState('');
  const [tzadeNumber, setTzadeNumber] = useState('');
  const [pluga, setPluga] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  // Keep track of recently added devices in this session
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);

  // Ref to manually focus the tzade input after submission
  const tzadeInputRef = useRef<TextInput>(null);

  const isValid = equipmentType.trim() !== '' && tzadeNumber.trim() !== '';

  const handleAddDevice = async () => {
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

      const id = await addDevice(newDeviceData);
      
      // Learn new options
      learnNewOption('equipment', equipmentType);
      learnNewOption('platoon', pluga.trim() || 'מחלקת קשר');
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim() || 'מחלקת קשר');
      }

      // Add to local list (at the top)
      setRecentDevices([{ id, ...newDeviceData }, ...recentDevices]);
      
      // RAPID ENTRY TRICK: Clear Tsadi Number, Platoon, and Location
      setTzadeNumber('');
      setPluga('');
      setLocation('');
      
      // Focus back on the input for the next item
      setTimeout(() => {
        tzadeInputRef.current?.focus();
      }, 100);

    } catch (error: any) {
      console.error(error);
      if (error.message === 'DUPLICATE_TSADI') {
        alert('מספר צ\' זה כבר קיים בפלוגה זו.');
      } else {
        alert('שגיאה בהוספת הציוד. נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSetup = () => {
    router.replace('/report/kashrag');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>הקמת ציוד לדו&quot;ח חכם</Text>
          <Text style={styles.subtitle}>הוספה מהירה ורצופה. דו&quot;ח נוכחי: {selectedDohName || selectedDohId}</Text>
        </View>

        <ScrollView 
          style={styles.formContainer} 
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Device Type */}
          <Text style={styles.label}>סוג ציוד (חובה)</Text>
          <SearchableDropdown
            data={getAllEquipmentTypes()}
            value={equipmentType}
            onSelect={setEquipmentType}
            placeholder="חפש ובחר סוג ציוד..."
          />

          {/* Tsadi Number */}
          <Text style={styles.label}>מספר צ / מזהה (חובה)</Text>
          <TextInput
            ref={tzadeInputRef}
            style={styles.input}
            placeholder="הזן מספר צ'"
            value={tzadeNumber}
            onChangeText={setTzadeNumber}
            keyboardType="numeric"
            onSubmitEditing={handleAddDevice}
            returnKeyType="done"
          />

          {/* Platoon */}
          <Text style={styles.label}>שיוך לפלוגה (אופציונלי - ברירת מחדל: מחלקת קשר)</Text>
          <SearchableDropdown
            data={getAllPlatoons()}
            value={pluga}
            onSelect={setPluga}
            placeholder="חפש ובחר פלוגה..."
          />

          {/* Location / Role */}
          <Text style={styles.label}>מיקום / תפקיד (אופציונלי)</Text>
          <SearchableDropdown
            data={getLocationsForPlatoon(pluga.trim() || 'מחלקת קשר')}
            value={location}
            onSelect={setLocation}
            placeholder='בחר או הקלד מיקום (למשל האמר 123)...'
            allowFreeText={true}
          />
          <TouchableOpacity 
            style={[styles.addButton, (!isValid || loading) && styles.disabledButton]} 
            onPress={handleAddDevice}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.addButtonText}>+ הוסף מכשיר מהיר</Text>
            )}
          </TouchableOpacity>

          {/* Recently Added Section */}
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>נוספו לאחרונה ({recentDevices.length}):</Text>
            {recentDevices.length === 0 ? (
              <Text style={styles.emptyRecent}>טרם נוספו מכשירים בסשן זה</Text>
            ) : (
              recentDevices.slice(0, 10).map((device, index) => (
                <View key={device.id || index} style={styles.recentItem}>
                  <Text style={styles.recentIcon}>✅</Text>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentType}>{device.type} - צ&apos;: {device.tsadiNumber}</Text>
                    <Text style={styles.recentAssignment}>{device.assignment}{device.location ? ` | ${device.location}` : ''}</Text>
                  </View>
                </View>
              ))
            )}
            {recentDevices.length > 10 && (
              <Text style={styles.moreText}>ועוד {recentDevices.length - 10} מכשירים...</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.finishButton} onPress={handleFinishSetup}>
            <Text style={styles.finishButtonText}>סיום ומעבר לדו&quot;ח הראשי</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 5,
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'right',
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    fontSize: 18,
    textAlign: 'right',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: theme.colors.success,
    padding: 18,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 2,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: theme.colors.surfaceLight,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recentSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text,
    textAlign: 'right',
  },
  emptyRecent: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  recentItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recentIcon: {
    fontSize: 18,
    marginLeft: 10,
  },
  recentInfo: {
    flex: 1,
  },
  recentType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'right',
  },
  recentAssignment: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  moreText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: 14,
  },
  footer: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  finishButton: {
    backgroundColor: theme.colors.primary,
    padding: 18,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
