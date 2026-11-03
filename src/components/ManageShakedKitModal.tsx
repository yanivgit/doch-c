import React, { useState, useMemo } from 'react';
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  Device, 
  unlinkKitMember, 
  linkKitMember, 
  addDevice 
} from '../firebase/api';
import { theme } from '../theme/theme';
import { useApp } from '../context/AppContext';

interface ManageShakedKitModalProps {
  kitDevice: Device | null;
  visible: boolean;
  onClose: () => void;
  onUpdated: () => void;
  allDevices: Device[];
  onReportFault: (device: Device) => void;
  onReplaceDevice: (device: Device) => void;
}

type SlotRole = 'tel100' | 'maban' | 'tablet';

export default function ManageShakedKitModal({
  kitDevice,
  visible,
  onClose,
  onUpdated,
  allDevices = [],
  onReportFault,
  onReplaceDevice,
}: ManageShakedKitModalProps) {
  const { userRole, selectedDohId } = useApp();
  const [loading, setLoading] = useState(false);

  // Active editing slot for replacement/linking
  const [activeSlot, setActiveSlot] = useState<SlotRole | null>(null);
  const [newTsadiInput, setNewTsadiInput] = useState('');
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [slotMode, setSlotMode] = useState<'new' | 'existing'>('new');

  // Member devices
  const tel100Device = useMemo(() => {
    if (!kitDevice?.tel100DeviceId) return null;
    return allDevices.find(d => d.id === kitDevice.tel100DeviceId) || null;
  }, [allDevices, kitDevice]);

  const mabanDevice = useMemo(() => {
    if (!kitDevice?.mabanDeviceId) return null;
    return allDevices.find(d => d.id === kitDevice.mabanDeviceId) || null;
  }, [allDevices, kitDevice]);

  const tabletDevice = useMemo(() => {
    if (!kitDevice?.tabletDeviceId) return null;
    return allDevices.find(d => d.id === kitDevice.tabletDeviceId) || null;
  }, [allDevices, kitDevice]);

  // Available free devices for active slot
  const availableForActiveSlot = useMemo(() => {
    if (!activeSlot) return [];
    const roleTypeName = activeSlot === 'tel100' ? 'טל 100' : (activeSlot === 'maban' ? 'מבן' : 'טאבלט');
    return allDevices.filter(d => 
      (d.type || '').toLowerCase().includes(roleTypeName.toLowerCase()) && !d.parentKitId
    );
  }, [allDevices, activeSlot]);

  if (!visible || !kitDevice) return null;

  const handleStartSlotEdit = (role: SlotRole) => {
    setActiveSlot(role);
    setNewTsadiInput('');
    setSelectedExistingId(null);
    setSlotMode('new');
  };

  const handleCancelSlotEdit = () => {
    setActiveSlot(null);
    setNewTsadiInput('');
    setSelectedExistingId(null);
  };

  const handleUnlink = async (role: SlotRole) => {
    if (!kitDevice.id) return;
    const kitId = kitDevice.id;

    const perform = async () => {
      setLoading(true);
      try {
        await unlinkKitMember(kitId, role, userRole === 'Kashpal' ? 'קשפ"ל' : 'קשר"ג');
        Alert.alert('הצלחה', 'הפריט נותק מהערכה בהצלחה.');
        onUpdated();
      } catch (e: any) {
        Alert.alert('שגיאה', e?.message || 'לא ניתן לנתק את הפריט.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('האם אתה בטוח שברצונך לנתק את הפריט מהערכה?')) {
        await perform();
      }
      return;
    }

    Alert.alert(
      'ניתוק פריט מהערכה',
      'האם לנתק את הפריט? הוא יחזור למצבת הציוד הפנוי בפלוגה.',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'נתק פריט', style: 'destructive', onPress: perform }
      ]
    );
  };

  const handleSaveSlot = async () => {
    if (!kitDevice.id || !activeSlot) return;
    const kitId = kitDevice.id;
    const roleTypeName = activeSlot === 'tel100' ? 'טל 100' : (activeSlot === 'maban' ? 'מבן' : 'טאבלט');

    setLoading(true);
    try {
      let targetDeviceId = selectedExistingId;

      if (slotMode === 'new') {
        const cleanTsadi = newTsadiInput.trim();
        if (!cleanTsadi) {
          Alert.alert('חסר מספר צ׳', 'אנא הקלד מספר צ׳ תקין.');
          setLoading(false);
          return;
        }

        const conflict = allDevices.find(d => (d.tsadiNumber || '').trim().toLowerCase() === cleanTsadi.toLowerCase());
        if (conflict) {
          Alert.alert('צ׳ כפול במצבה', `מספר צ׳ ${cleanTsadi} כבר קיים במערכת (${conflict.type} ב-${conflict.assignment || 'ללא שיוך'}).`);
          setLoading(false);
          return;
        }

        targetDeviceId = await addDevice({
          type: roleTypeName,
          tsadiNumber: cleanTsadi,
          assignment: kitDevice.assignment,
          location: kitDevice.location || '',
          dohId: selectedDohId || kitDevice.dohId || '',
          parentKitId: kitId,
          kitRole: activeSlot
        });
      }

      if (!targetDeviceId) {
        Alert.alert('שגיאה', 'לא נבחר מכשיר לצימוד.');
        setLoading(false);
        return;
      }

      await linkKitMember(kitId, activeSlot, targetDeviceId, userRole === 'Kashpal' ? 'קשפ"ל' : 'קשר"ג');
      Alert.alert('הצלחה', `${roleTypeName} קושר לערכה בהצלחה!`);
      setActiveSlot(null);
      onUpdated();
    } catch (e: any) {
      console.error("Error linking kit slot:", e);
      Alert.alert('שגיאה', e?.message || 'שגיאה בצימוד הפריט.');
    } finally {
      setLoading(false);
    }
  };

  const renderSlotRow = (
    role: SlotRole, 
    roleName: string, 
    iconName: any, 
    memberDevice: Device | null, 
    fallbackTsadi?: string
  ) => {
    const isEditingThisSlot = activeSlot === role;
    const isPresent = Boolean(memberDevice || fallbackTsadi);
    const tsadiDisplay = memberDevice?.tsadiNumber || fallbackTsadi || 'ריק';
    const fault = memberDevice?.faultStatus;

    return (
      <View key={role} style={[styles.slotCard, isEditingThisSlot && styles.slotCardEditing]}>
        <View style={styles.slotTopRow}>
          <View style={styles.slotInfo}>
            <View style={styles.slotIconCircle}>
              <MaterialCommunityIcons name={iconName} size={18} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.slotRoleText}>{roleName}</Text>
              <Text style={[styles.slotTsadiText, !isPresent && { color: '#94A3B8' }]}>
                {isPresent ? `צ׳ ${tsadiDisplay}` : 'לא הוגדר (פנוי)'}
              </Text>
            </View>
          </View>

          {/* Fault status if present */}
          {fault && (
            <View style={styles.faultBadge}>
              <Feather 
                name={fault === 'replacement' ? 'alert-octagon' : 'alert-circle'} 
                size={12} 
                color={fault === 'replacement' ? '#DC2626' : '#B45309'} 
              />
              <Text style={[styles.faultBadgeText, { color: fault === 'replacement' ? '#DC2626' : '#B45309' }]}>
                {fault === 'replacement' ? 'דורש החלפה' : 'בדיקת קשר'}
              </Text>
            </View>
          )}

          {/* Quick slot actions */}
          {!isEditingThisSlot && (
            <View style={styles.slotActionButtons}>
              {isPresent ? (
                <>
                  {memberDevice && (
                    <>
                      <TouchableOpacity 
                        style={styles.actionIconBtn} 
                        onPress={() => onReportFault(memberDevice)}
                        accessibilityLabel="דווח תקלה"
                      >
                        <Feather name="alert-triangle" size={13} color="#B45309" />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionIconBtn} 
                        onPress={() => onReplaceDevice(memberDevice)}
                        accessibilityLabel="החלף בחטיבה"
                      >
                        <Feather name="refresh-cw" size={13} color="#0284C7" />
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity 
                    style={[styles.actionIconBtn, { backgroundColor: '#FEE2E2' }]} 
                    onPress={() => handleUnlink(role)}
                    accessibilityLabel="הסר מהערכה"
                  >
                    <Feather name="trash-2" size={13} color="#DC2626" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionPillBtn, { backgroundColor: '#E0F2FE' }]} 
                    onPress={() => handleStartSlotEdit(role)}
                  >
                    <Text style={styles.actionPillText}>החלף</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[styles.actionPillBtn, { backgroundColor: '#0284C7' }]} 
                  onPress={() => handleStartSlotEdit(role)}
                >
                  <Feather name="plus" size={12} color="#FFFFFF" style={{ marginLeft: 3 }} />
                  <Text style={[styles.actionPillText, { color: '#FFFFFF' }]}>חבר {roleName}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Inline editor when this slot is being changed/added */}
        {isEditingThisSlot && (
          <View style={styles.inlineEditor}>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity 
                style={[styles.modeToggleBtn, slotMode === 'new' && styles.modeToggleBtnActive]}
                onPress={() => setSlotMode('new')}
              >
                <Text style={[styles.modeToggleText, slotMode === 'new' && styles.modeToggleTextActive]}>
                  + צ׳ חדש
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeToggleBtn, slotMode === 'existing' && styles.modeToggleBtnActive]}
                onPress={() => setSlotMode('existing')}
              >
                <Text style={[styles.modeToggleText, slotMode === 'existing' && styles.modeToggleTextActive]}>
                  בחר פנוי מהמצבה ({availableForActiveSlot.length})
                </Text>
              </TouchableOpacity>
            </View>

            {slotMode === 'new' ? (
              <TextInput
                style={styles.input}
                placeholder={`הקלד מספר צ׳ של ה-${roleName}...`}
                placeholderTextColor="#94A3B8"
                value={newTsadiInput}
                onChangeText={setNewTsadiInput}
                keyboardType="numeric"
                inputMode="numeric"
                textAlign="right"
              />
            ) : (
              <View>
                {availableForActiveSlot.length === 0 ? (
                  <Text style={styles.noAvailableText}>אין {roleName} פנוי במצבה (בחר בצ׳ חדש)</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devicesScroll}>
                    {availableForActiveSlot.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.devicePill, selectedExistingId === item.id && styles.devicePillSelected]}
                        onPress={() => setSelectedExistingId(item.id || null)}
                      >
                        <Text style={[styles.devicePillText, selectedExistingId === item.id && styles.devicePillTextSelected]}>
                          צ׳ {item.tsadiNumber} ({item.assignment})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <View style={styles.inlineActions}>
              <TouchableOpacity 
                style={styles.inlineSaveBtn} 
                onPress={handleSaveSlot}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.inlineSaveBtnText}>שמור {roleName}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.inlineCancelBtn} 
                onPress={handleCancelSlotEdit}
                disabled={loading}
              >
                <Text style={styles.inlineCancelBtnText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
            
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <View style={styles.headerIconCircle}>
                  <MaterialCommunityIcons name="toolbox" size={20} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.title}>{kitDevice.kitName || kitDevice.tsadiNumber || 'ערכת שקד'}</Text>
                  <Text style={styles.subtitle}>
                    שיוך: {kitDevice.assignment}{kitDevice.location ? ` • ${kitDevice.location}` : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="סגור">
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Instruction Banner */}
            <View style={styles.instructionBanner}>
              <Feather name="info" size={14} color="#0284C7" style={{ marginLeft: 6 }} />
              <Text style={styles.instructionText}>
                ערכת שקד מאגדת 3 מכשירים. ניתן לדווח תקלה, להחליף בחטיבה, או להחליף פריט בכל אחד מהחריצים.
              </Text>
            </View>

            {/* 3 Slots */}
            {renderSlotRow('tel100', 'טל 100', 'phone', tel100Device, kitDevice.tel100Tsadi)}
            {renderSlotRow('maban', 'מבן', 'power-plug', mabanDevice, kitDevice.mabanTsadi)}
            {renderSlotRow('tablet', 'טאבלט', 'tablet', tabletDevice, kitDevice.tabletTsadi)}

            {/* Close Button */}
            <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
              <Text style={styles.closeModalBtnText}>סגור</Text>
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
    padding: 16,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 18,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },

  instructionBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    textAlign: 'right',
    lineHeight: 16,
  },

  slotCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  slotCardEditing: {
    borderColor: '#0284C7',
    backgroundColor: '#FAFCFF',
  },
  slotTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  slotIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotRoleText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  slotTsadiText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
  },

  faultBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  faultBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  slotActionButtons: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },

  inlineEditor: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modeToggleRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 2,
    marginBottom: 8,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
  },
  modeToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  modeToggleText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  modeToggleTextActive: {
    color: '#0284C7',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 8,
  },
  noAvailableText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    paddingVertical: 4,
  },
  devicesScroll: {
    flexDirection: 'row-reverse',
    gap: 6,
    paddingVertical: 4,
  },
  devicePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  devicePillSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  devicePillText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  devicePillTextSelected: {
    color: '#0284C7',
    fontWeight: 'bold',
  },

  inlineActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 6,
  },
  inlineSaveBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  inlineSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inlineCancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  inlineCancelBtnText: {
    color: '#64748B',
    fontSize: 12,
  },

  closeModalBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  closeModalBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
});

