import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Modal, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TextInput, 
  ActivityIndicator 
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { findDeviceByTsadi, updateDeviceFaultStatus, Device } from '../firebase/api';
import { useApp } from '../context/AppContext';

interface ReportFaultModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialDevice?: Device | null;
}

export default function ReportFaultModal({ 
  visible, 
  onClose, 
  onSuccess, 
  initialDevice 
}: ReportFaultModalProps) {
  const { userRole, selectedPlatoon, selectedDohId } = useApp();

  const [tsadiInput, setTsadiInput] = useState('');
  const [device, setDevice] = useState<Device | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'inspection' | 'replacement'>('inspection');
  const [notes, setNotes] = useState('');

  // Reset or populate on visibility change
  useEffect(() => {
    if (visible) {
      if (initialDevice) {
        setTsadiInput(initialDevice.tsadiNumber);
        setDevice(initialDevice);
        setSeverity(initialDevice.faultStatus || 'inspection');
        setNotes(initialDevice.faultNotes || '');
        setErrorMessage(null);
      } else {
        setTsadiInput('');
        setDevice(null);
        setSeverity('inspection');
        setNotes('');
        setErrorMessage(null);
      }
    }
  }, [visible, initialDevice]);

  // Query Firestore to validate device existence & role permissions
  const handleValidateTsadi = async () => {
    const cleanTsadi = tsadiInput.trim();
    if (!cleanTsadi) {
      setErrorMessage('נא להזין מספר צדיק');
      return;
    }

    setValidating(true);
    setErrorMessage(null);

    try {
      const found = await findDeviceByTsadi(cleanTsadi, selectedDohId || undefined);

      if (!found || !found.id) {
        setErrorMessage(`מספר צ' "${cleanTsadi}" לא נמצא במאגר המכשירים.`);
        setDevice(null);
        return;
      }

      // Validation 2: If current user is Kashpal, device platoon MUST match their selectedPlatoon
      if (userRole === 'Kashpal') {
        const devPlatoon = (found.assignment || '').trim();
        const myPlatoon = (selectedPlatoon || '').trim();
        if (myPlatoon && devPlatoon !== myPlatoon) {
          setErrorMessage(
            `אין הרשאה: מכשיר זה שייך לפלוגה "${devPlatoon || 'לא משויך'}". בתור קשפ"ל, הנך מורשה לדווח אך ורק על מכשירי ${myPlatoon}.`
          );
          setDevice(null);
          return;
        }
      }

      setDevice(found);
      setSeverity(found.faultStatus || 'inspection');
      setNotes(found.faultNotes || '');
      setErrorMessage(null);
    } catch (error) {
      console.error('Error validating device:', error);
      setErrorMessage('שגיאה בבדיקת נתוני המכשיר מול השרת.');
      setDevice(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (faultChoice?: 'inspection' | 'replacement' | null) => {
    if (!device || !device.id) return;

    const chosenStatus = faultChoice !== undefined ? faultChoice : severity;
    setSubmitting(true);

    try {
      const currentUser = userRole === 'Kashpal'
        ? (selectedPlatoon ? `קשפ"ל_${selectedPlatoon}` : 'קשפ"ל')
        : (userRole === 'Kashrag' ? 'קשר"ג' : 'משתמש כללי');

      await updateDeviceFaultStatus(
        device.id, 
        chosenStatus, 
        currentUser, 
        notes.trim() || undefined
      );

      if (chosenStatus) {
        Alert.alert(
          'הדיווח נרשם בהצלחה', 
          `המכשיר (צ' ${device.tsadiNumber}) עודכן כעת כ-${chosenStatus === 'inspection' ? 'דרושה בדיקת קשר' : 'דורש החלפה מול חטיבה'}.`
        );
      } else {
        Alert.alert('התקלה בוטלה', `המכשיר (צ' ${device.tsadiNumber}) הוחזר לסטטוס תקין.`);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating fault status:', error);
      Alert.alert('שגיאה', 'שגיאה בעדכון סטטוס התקלה. אנא נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView 
            keyboardShouldPersistTaps="handled" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerIconBox}>
                  <Feather name="alert-triangle" size={20} color="#D97706" />
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.title}>דיווח תקלה למכשיר</Text>
                  <Text style={styles.subtitle}>בדיקת תקינות וסיווג חומרת תקלה</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Step 1: Input Tsadi Number (editable if initialDevice is not fixed) */}
            <Text style={styles.inputLabel}>מספר צ' של המכשיר (חובה):</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[
                  styles.tsadiInput, 
                  initialDevice && { backgroundColor: '#F1F5F9', color: '#475569' }
                ]}
                placeholder="הזן צ' (לדוגמה: 123-456)..."
                placeholderTextColor="#94A3B8"
                value={tsadiInput}
                onChangeText={(text) => {
                  setTsadiInput(text);
                  if (device && text.trim() !== device.tsadiNumber) {
                    setDevice(null);
                  }
                  if (errorMessage) setErrorMessage(null);
                }}
                editable={!initialDevice}
                textAlign="right"
                autoCapitalize="characters"
              />
              {!initialDevice && (
                <TouchableOpacity 
                  style={[styles.validateBtn, validating && { opacity: 0.7 }]}
                  onPress={handleValidateTsadi}
                  disabled={validating}
                  activeOpacity={0.8}
                >
                  {validating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="search" size={16} color="#FFFFFF" />
                      <Text style={styles.validateBtnText}>אתר</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Error Feedback */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={17} color="#DC2626" style={{ marginTop: 2 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Step 2: Validated Device Card */}
            {device && (
              <View style={styles.validatedSection}>
                <View style={styles.deviceCard}>
                  <View style={styles.deviceCardHeader}>
                    <View style={styles.deviceBadge}>
                      <Feather name="check" size={13} color="#15803D" />
                      <Text style={styles.deviceBadgeText}>אומת במערכת</Text>
                    </View>
                    <Text style={styles.deviceTypeTitle}>{device.type}</Text>
                  </View>

                  <View style={styles.deviceDetailsGrid}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>פלוגה משויכת:</Text>
                      <Text style={styles.detailValue}>{device.assignment || 'ללא שיוך'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>מיקום נוכחי:</Text>
                      <Text style={styles.detailValue}>{device.location || 'ללא מיקום'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>מספר צ':</Text>
                      <Text style={styles.detailValueBold}>{device.tsadiNumber}</Text>
                    </View>
                  </View>

                  {device.faultStatus && (
                    <View style={[
                      styles.currentFaultBanner,
                      device.faultStatus === 'replacement' ? styles.currentFaultRed : styles.currentFaultOrange
                    ]}>
                      <Feather 
                        name={device.faultStatus === 'replacement' ? 'alert-octagon' : 'alert-circle'} 
                        size={15} 
                        color={device.faultStatus === 'replacement' ? '#DC2626' : '#D97706'} 
                      />
                      <Text style={[
                        styles.currentFaultText,
                        device.faultStatus === 'replacement' ? { color: '#DC2626' } : { color: '#D97706' }
                      ]}>
                        סטטוס תקלה נוכחי: {device.faultStatus === 'replacement' ? 'דורש החלפה' : 'דרושה בדיקת קשר'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Step 3: Severity Choices */}
                <Text style={styles.severitySectionTitle}>סווג את חומרת התקלה:</Text>
                
                {/* Choice 1: Orange (דרושה בדיקת קשר) */}
                <TouchableOpacity
                  style={[
                    styles.severityOption,
                    styles.severityOptionOrange,
                    severity === 'inspection' && styles.severityOptionOrangeActive
                  ]}
                  onPress={() => setSeverity('inspection')}
                  activeOpacity={0.85}
                >
                  <View style={[
                    styles.severityRadioCircle,
                    severity === 'inspection' && styles.severityRadioCircleOrangeActive
                  ]}>
                    {severity === 'inspection' && <View style={styles.severityRadioInnerOrange} />}
                  </View>

                  <View style={styles.severityTextCol}>
                    <View style={styles.severityTitleRow}>
                      <View style={[styles.colorDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={[styles.severityTitle, severity === 'inspection' && { color: '#B45309' }]}>
                        דרושה בדיקת קשר (כתום)
                      </Text>
                    </View>
                    <Text style={styles.severityDesc}>
                      תקלה קלה, רעש, חוסר שמע או חשד לליקוי. נדרשת בדיקה של מחלקת הקשר / קשר"ג.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Choice 2: Red (דורש החלפה) */}
                <TouchableOpacity
                  style={[
                    styles.severityOption,
                    styles.severityOptionRed,
                    severity === 'replacement' && styles.severityOptionRedActive
                  ]}
                  onPress={() => setSeverity('replacement')}
                  activeOpacity={0.85}
                >
                  <View style={[
                    styles.severityRadioCircle,
                    severity === 'replacement' && styles.severityRadioCircleRedActive
                  ]}>
                    {severity === 'replacement' && <View style={styles.severityRadioInnerRed} />}
                  </View>

                  <View style={styles.severityTextCol}>
                    <View style={styles.severityTitleRow}>
                      <View style={[styles.colorDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.severityTitle, severity === 'replacement' && { color: '#DC2626' }]}>
                        דורש החלפה (אדום)
                      </Text>
                    </View>
                    <Text style={styles.severityDesc}>
                      מכשיר מושבת, שבור פיזית או לא נדלק. דורש החלפה מול דרג חטיבה (החלפה מול חטיבה).
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Step 4: Optional Notes */}
                <Text style={styles.inputLabel}>פירוט נוסף של התקלה (אופציונלי):</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="תאר בקצרה מה לא עובד במכשיר..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlign="right"
                  textAlignVertical="top"
                />

                {/* Actions */}
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.submitButton, submitting && { opacity: 0.7 }]}
                    onPress={() => handleSubmit(severity)}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>שמור דיווח תקלה</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Reset to healthy if device already has a fault */}
                  {device.faultStatus && (
                    <TouchableOpacity
                      style={styles.clearFaultBtn}
                      onPress={() => handleSubmit(null)}
                      disabled={submitting}
                      activeOpacity={0.8}
                    >
                      <Feather name="check-circle" size={15} color="#15803D" />
                      <Text style={styles.clearFaultBtnText}>בטל תקלה (סמן כמכשיר תקין)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'right',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tsadiInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E6B3A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  validateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
  },
  validatedSection: {
    marginTop: 6,
  },
  deviceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  deviceTypeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  deviceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  deviceDetailsGrid: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  detailValueBold: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '800',
  },
  currentFaultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  currentFaultOrange: {
    backgroundColor: '#FEF3C7',
  },
  currentFaultRed: {
    backgroundColor: '#FEE2E2',
  },
  currentFaultText: {
    fontSize: 12,
    fontWeight: '700',
  },
  severitySectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'right',
  },
  severityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  severityOptionOrange: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FED7AA',
  },
  severityOptionOrangeActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  severityOptionRed: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
  },
  severityOptionRedActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  severityRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityRadioCircleOrangeActive: {
    borderColor: '#F59E0B',
  },
  severityRadioInnerOrange: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  severityRadioCircleRedActive: {
    borderColor: '#EF4444',
  },
  severityRadioInnerRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  severityTextCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  severityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  severityDesc: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    textAlign: 'right',
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 68,
    marginBottom: 16,
  },
  actionsContainer: {
    gap: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E6B3A',
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: '#1E6B3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  clearFaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    paddingVertical: 10,
  },
  clearFaultBtnText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
});
