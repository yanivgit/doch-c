import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Modal, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { addDevice, Device } from '../firebase/api';
import { useApp } from '../context/AppContext';
import SearchableDropdown from './SearchableDropdown';

interface AddDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddDeviceModal({ visible, onClose, onAdded }: AddDeviceModalProps) {
  const { 
    selectedDohId, 
    selectedDohName, 
    getAllEquipmentTypes, 
    getAllPlatoons, 
    getLocationsForPlatoon, 
    learnNewOption 
  } = useApp();
  
  const [equipmentType, setEquipmentType] = useState('');
  const [tzadeNumber, setTzadeNumber] = useState('');
  const [pluga, setPluga] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [tsadiError, setTsadiError] = useState<string | null>(null);

  // Keep track of devices added in this modal session
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);

  // Ref to manually focus the tzade input after submission
  const tzadeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTsadiError(null);
    }
  }, [visible]);

  const isValid = equipmentType.trim() !== '' && tzadeNumber.trim() !== '';

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('שדות חובה חסרים', 'אנא מלא סוג ציוד ומספר צ\' כדי להוסיף את המכשיר.');
      return;
    }

    setLoading(true);
    setTsadiError(null);

    try {
      const newDeviceData = {
        type: equipmentType.trim(),
        tsadiNumber: tzadeNumber.trim(),
        assignment: pluga.trim() || 'מחלקת קשר',
        location: location.trim(),
        dohId: selectedDohId || ''
      };

      const id = await addDevice(newDeviceData);
      
      // Dynamic metadata learning
      learnNewOption('equipment', equipmentType.trim());
      learnNewOption('platoon', pluga.trim() || 'מחלקת קשר');
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim() || 'מחלקת קשר');
      }

      // Add to local session list (at the top)
      setRecentDevices(prev => [{ id, ...newDeviceData }, ...prev]);
      
      // Rapid entry workflow: clear Tsadi, Pluga, Location
      setTzadeNumber('');
      setPluga('');
      setLocation('');
      setTsadiError(null);

      // Notify parent screen to update device counts
      onAdded();
      
      // Focus back on the input for the next item
      setTimeout(() => {
        tzadeInputRef.current?.focus();
      }, 100);

    } catch (error: any) {
      console.error("Error adding device:", error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('קיים') || errorMessage === 'DUPLICATE_TSADI') {
        const dupMsg = errorMessage.includes('קיים') ? errorMessage : "מכשיר עם צ' זה כבר קיים במצבת הגדוד.";
        setTsadiError(dupMsg);
        Alert.alert('שגיאה', dupMsg);
      } else {
        Alert.alert('שגיאה', 'שגיאה בהוספת הציוד. נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        
        {/* 1. Tactical Command Header */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            <View style={styles.badgeRow}>
              <View style={styles.unitBadge}>
                <MaterialIcons name="shield" size={14} color="#15803D" />
                <Text style={styles.unitBadgeText}>
                  {selectedDohName ? `מסדר: ${selectedDohName}` : 'הקמת מסדר גדודי'}
                </Text>
              </View>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>קליטה מהירה</Text>
              </View>
            </View>
            <Text style={styles.title}>הוספת ציוד חדש</Text>
          </View>

          <TouchableOpacity 
            testID="close-add-device"
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityLabel="סגור הוספת ציוד"
          >
            <Text style={styles.closeButtonText}>סגור</Text>
            <Feather name="x" size={16} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView 
            style={styles.scrollBody} 
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Rapid Add Card */}
            <View style={styles.formCard}>
              <View style={styles.formCardHeader}>
                <View style={styles.formHeaderIcon}>
                  <Feather name="zap" size={18} color="#15803D" />
                </View>
                <View style={styles.formHeaderTitles}>
                  <Text style={styles.formTitle}>הוספה מהירה ורצופה</Text>
                  <Text style={styles.formSubtitle}>הזן נתונים ולחץ "הוסף מכשיר למצבה" למעבר מיידי למכשיר הבא</Text>
                </View>
              </View>

              {/* Field 1: Device Type */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.requiredStar}>*</Text>
                  <Text style={styles.label}>סוג ציוד</Text>
                </View>
                <SearchableDropdown
                  data={getAllEquipmentTypes()}
                  value={equipmentType}
                  onSelect={setEquipmentType}
                  placeholder="חפש ובחר סוג ציוד (למשל מ.ק 710)..."
                  allowFreeText={true}
                />
              </View>

              {/* Field 2: Tsadi Number */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.requiredStar}>*</Text>
                  <Text style={styles.label}>מספר צ' / מזהה צבאי</Text>
                </View>
                <TextInput
                  ref={tzadeInputRef}
                  style={[styles.input, tsadiError ? styles.inputError : null]}
                  placeholder="הזן מספר צ' (למשל 94821)"
                  placeholderTextColor="#94A3B8"
                  value={tzadeNumber}
                  onChangeText={(val) => {
                    setTzadeNumber(val);
                    if (tsadiError) setTsadiError(null);
                  }}
                  keyboardType="default"
                  onSubmitEditing={handleSubmit}
                  returnKeyType="done"
                />
                {tsadiError ? (
                  <View style={styles.errorRow}>
                    <Feather name="alert-circle" size={13} color="#DC2626" />
                    <Text style={styles.errorText}>{tsadiError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Field 3: Platoon Assignment */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.optionalTag}>ברירת מחדל: מחלקת קשר</Text>
                  <Text style={styles.label}>שיוך לפלוגה</Text>
                </View>
                <SearchableDropdown
                  data={getAllPlatoons()}
                  value={pluga}
                  onSelect={setPluga}
                  placeholder="בחר פלוגה (אופציונלי)..."
                />
              </View>

              {/* Field 4: Location / Vehicle */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.optionalTag}>אופציונלי</Text>
                  <Text style={styles.label}>מיקום / כלי / בעל תפקיד</Text>
                </View>
                <SearchableDropdown
                  data={getLocationsForPlatoon(pluga.trim() || 'מחלקת קשר')}
                  value={location}
                  onSelect={setLocation}
                  placeholder='בחר או הקלד מיקום (למשל האמר מ"פ)...'
                  allowFreeText={true}
                />
              </View>

              {/* Rapid Add Submit Button */}
              <TouchableOpacity 
                style={[styles.addButton, (!isValid || loading) && styles.disabledButton]} 
                onPress={handleSubmit}
                disabled={!isValid || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.addButtonContent}>
                    <Feather name="plus-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>הוסף מכשיר למצבה</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Recently Added Section */}
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <View style={styles.recentCountBadge}>
                  <Text style={styles.recentCountText}>{recentDevices.length}</Text>
                </View>
                <Text style={styles.recentTitle}>מכשירים שנוספו בסשן זה:</Text>
              </View>

              {recentDevices.length === 0 ? (
                <View style={styles.emptyRecentBox}>
                  <Feather name="inbox" size={28} color="#94A3B8" />
                  <Text style={styles.emptyRecentText}>טרם נוספו מכשירים בסשן זה</Text>
                  <Text style={styles.emptyRecentSub}>הזן את פרטי המכשיר בטופס למעלה</Text>
                </View>
              ) : (
                <View style={styles.recentList}>
                  {recentDevices.slice(0, 15).map((device) => (
                    <View key={device.id || device.tsadiNumber} style={styles.recentItem}>
                      <View style={styles.recentCheckCircle}>
                        <Feather name="check" size={14} color="#15803D" />
                      </View>
                      <View style={styles.recentInfo}>
                        <View style={styles.recentInfoTop}>
                          <Text style={styles.recentType}>{device.type}</Text>
                          <View style={styles.recentTsadiBadge}>
                            <Text style={styles.recentTsadiText}>צ׳ {device.tsadiNumber}</Text>
                          </View>
                        </View>
                        <Text style={styles.recentAssignment}>
                          {device.assignment}{device.location ? ` • ${device.location}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {recentDevices.length > 15 && (
                    <Text style={styles.moreText}>
                      ועוד {recentDevices.length - 15} מכשירים נוספים שנשמרו בהצלחה
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Tactical Footer Action Bar */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.finishButton} 
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.finishButtonText}>סיום וחזרה ללוח הבקרה</Text>
              <Feather name="arrow-left" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  unitBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  stepBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  closeButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  closeButtonText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  formCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  formHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderTitles: {
    flex: 1,
    alignItems: 'flex-end',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  formSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'right',
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
    marginRight: 4,
  },
  optionalTag: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    color: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#15803D',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    elevation: 2,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  recentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  recentHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentCountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recentCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  emptyRecentBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
  },
  emptyRecentSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  recentCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {
    flex: 1,
  },
  recentInfoTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  recentType: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  recentTsadiBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  recentTsadiText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentAssignment: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  moreText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  finishButton: {
    flexDirection: 'row-reverse',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
