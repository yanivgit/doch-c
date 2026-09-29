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
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { replaceDeviceAtBrigade, Device } from '../firebase/api';
import { useApp } from '../context/AppContext';

interface ReplaceDeviceModalProps {
  device: Device | null;
  visible: boolean;
  onClose: () => void;
  onReplaced?: () => void;
}

export default function ReplaceDeviceModal({
  device,
  visible,
  onClose,
  onReplaced
}: ReplaceDeviceModalProps) {
  const { userRole, selectedPlatoon } = useApp();
  const [newTsadi, setNewTsadi] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setNewTsadi('');
      setLoading(false);
      setErrorMessage(null);
    }
  }, [visible, device]);

  if (!device) return null;

  const handleSubmit = async () => {
    const cleanTsadi = newTsadi.trim();
    if (!cleanTsadi) {
      setErrorMessage('נא להזין מספר צדיק חדש שהתקבל מהחטיבה');
      return;
    }

    if (cleanTsadi === device.tsadiNumber) {
      setErrorMessage('הצדיק החדש אינו יכול להיות זהה לצדיק התקול הישן');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const currentUser = userRole === 'Kashpal'
        ? (selectedPlatoon ? `קשפ"ל_${selectedPlatoon}` : 'קשפ"ל')
        : (userRole === 'Kashrag' ? 'קשר"ג' : 'משתמש כללי');

      await replaceDeviceAtBrigade(device.id!, cleanTsadi, currentUser);

      Alert.alert(
        'ההחלפה הושלמה בהצלחה',
        `מכשיר ${device.type} הוחלף מול החטיבה:\nצ' ישן: ${device.tsadiNumber} ➔ צ' חדש: ${cleanTsadi}\nסטטוס המכשיר עודכן לתקין.`
      );

      onReplaced?.();
      onClose();
    } catch (error: any) {
      console.error('Error replacing device at brigade:', error);
      if (error?.message === 'DUPLICATE_TSADI') {
        setErrorMessage(`מספר צ' "${cleanTsadi}" כבר קיים במערכת עבור פריט אחר.`);
      } else {
        setErrorMessage('שגיאה בהחלפת המכשיר. אנא נסה שוב.');
      }
    } finally {
      setLoading(false);
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
                  <MaterialCommunityIcons name="swap-horizontal-bold" size={24} color="#DC2626" />
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.title}>החלפה מול חטיבה</Text>
                  <Text style={styles.subtitle}>הזנת צ' חלופי ואיפוס סטטוס תקלה</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current Defective Device Info Card */}
            <View style={styles.deviceCard}>
              <View style={styles.deviceHeaderRow}>
                <View style={styles.defectivePill}>
                  <Feather name="alert-octagon" size={12} color="#DC2626" />
                  <Text style={styles.defectivePillText}>תקול (דורש החלפה)</Text>
                </View>
                <Text style={styles.deviceType}>{device.type}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>שיוך:</Text>
                <Text style={styles.metaValue}>{device.assignment || 'ללא שיוך'}</Text>
                {device.location ? (
                  <>
                    <Text style={styles.metaDivider}>•</Text>
                    <Text style={styles.metaLabel}>מיקום:</Text>
                    <Text style={styles.metaValue}>{device.location}</Text>
                  </>
                ) : null}
              </View>

              <View style={styles.oldTsadiBox}>
                <Text style={styles.oldTsadiLabel}>צ' ישן שמוחזר לחטיבה:</Text>
                <Text style={styles.oldTsadiValue}>{device.tsadiNumber}</Text>
              </View>
            </View>

            {/* Instruction Callout */}
            <View style={styles.instructionBox}>
              <MaterialIcons name="info-outline" size={17} color="#2563EB" style={{ marginTop: 2 }} />
              <Text style={styles.instructionText}>
                הזן את מספר הצדיק של המכשיר החדש והתקין שהתקבל מהחטיבה. עם האישור, המכשיר יחזור לסטטוס תקין עם הצדיק המעודכן.
              </Text>
            </View>

            {/* New Tsadi Input */}
            <Text style={styles.inputLabel}>מספר צ' חדש מהחטיבה (חובה):</Text>
            <TextInput
              style={styles.tsadiInput}
              placeholder="הזן צ' חדש (לדוגמה: 987-654)..."
              placeholderTextColor="#94A3B8"
              value={newTsadi}
              onChangeText={(text) => {
                setNewTsadi(text);
                if (errorMessage) setErrorMessage(null);
              }}
              textAlign="right"
              autoCapitalize="characters"
              autoFocus
            />

            {/* Error Feedback */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#DC2626" style={{ marginTop: 2 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.submitButton, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>אשר החלפה ועדכן מערכת</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>ביטול</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 460,
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
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
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
  deviceCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deviceType: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  defectivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  defectivePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  metaDivider: {
    fontSize: 10,
    color: '#94A3B8',
  },
  oldTsadiBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  oldTsadiLabel: {
    fontSize: 12,
    color: '#7F1D1D',
    fontWeight: '600',
  },
  oldTsadiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  instructionText: {
    flex: 1,
    fontSize: 11,
    color: '#1E40AF',
    lineHeight: 16,
    textAlign: 'right',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'right',
  },
  tsadiInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'right',
  },
  actionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: '#DC2626',
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
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
