import React, { useState, useEffect, useMemo } from 'react';
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
import { Device, linkDevices, unlinkDevices, addDevice } from '../firebase/api';
import { theme } from '../theme/theme';
import { useApp } from '../context/AppContext';

interface LinkMediaModalProps {
  hostDevice: Device | null;
  visible: boolean;
  onClose: () => void;
  onLinked: () => void;
  allDevices: Device[];
}

export default function LinkMediaModal({ 
  hostDevice, 
  visible, 
  onClose, 
  onLinked, 
  allDevices = []
}: LinkMediaModalProps) {
  const { userRole, selectedDohId } = useApp();
  const [searchTsadi, setSearchTsadi] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setSearchTsadi('');
      setSelectedTargetId(null);
    }
  }, [visible, hostDevice]);

  // Is the device currently being managed a media device?
  const isHostMedia = Boolean(hostDevice && (hostDevice.type || '').toLowerCase().includes('מדיה'));

  const isAllowedHost = (type?: string) => {
    if (!type) return false;
    const t = type.toLowerCase();
    return t.includes('מגן') || t.includes('מכלול') || t.includes('אלעד') || t.includes('שן בינה') || t.includes('בינה');
  };

  // Target candidate devices:
  // If hostDevice is media -> candidates are Magen Michlol / Elad Yarok / Shen Bina
  // If hostDevice is Magen Michlol / Elad Yarok / Shen Bina -> candidates are media
  const candidateDevices = useMemo(() => {
    if (!allDevices || !hostDevice) return [];
    if (!isHostMedia && !isAllowedHost(hostDevice.type)) return [];

    return allDevices.filter(d => {
      // Don't include the current device itself
      if (hostDevice && d.id === hostDevice.id) return false;

      const type = (d.type || '').toLowerCase();
      if (isHostMedia) {
        return isAllowedHost(type);
      } else {
        return type.includes('מדיה') || type.includes('נתיק');
      }
    });
  }, [allDevices, isHostMedia, hostDevice]);

  const availableCandidates = useMemo(() => {
    return candidateDevices.filter(d => !d.linkedDeviceId && !d.linkedTsadi);
  }, [candidateDevices]);

  const occupiedCandidates = useMemo(() => {
    return candidateDevices.filter(d => Boolean(d.linkedDeviceId || d.linkedTsadi));
  }, [candidateDevices]);

  // Filter candidates by typed search or availability
  const filteredCandidates = useMemo(() => {
    const q = searchTsadi.trim().toLowerCase();
    if (!q) {
      return [...availableCandidates, ...occupiedCandidates];
    }
    return candidateDevices.filter(d => 
      (d.tsadiNumber && d.tsadiNumber.toLowerCase().includes(q)) ||
      (d.type && d.type.toLowerCase().includes(q)) ||
      (d.assignment && d.assignment.toLowerCase().includes(q)) ||
      (d.location && d.location.toLowerCase().includes(q))
    );
  }, [candidateDevices, availableCandidates, occupiedCandidates, searchTsadi]);

  const exactMatch = useMemo(() => {
    const q = searchTsadi.trim().toLowerCase();
    if (!q) return undefined;
    return candidateDevices.find(
      m => m.tsadiNumber?.trim().toLowerCase() === q
    );
  }, [candidateDevices, searchTsadi]);

  const conflictDevice = useMemo(() => {
    const q = searchTsadi.trim().toLowerCase();
    if (!q || !allDevices) return null;
    return allDevices.find(d => {
      // Don't consider the current device as a conflict with itself
      if (hostDevice && d.id === hostDevice.id) return false;

      const tsadi = (d.tsadiNumber || '').trim().toLowerCase();
      const type = (d.type || '').toLowerCase();
      if (isHostMedia) {
        return tsadi === q && (type.includes('מדיה') || type.includes('נתיק'));
      } else {
        return tsadi === q && !type.includes('מדיה') && !type.includes('נתיק');
      }
    });
  }, [allDevices, searchTsadi, isHostMedia, hostDevice]);

  // ALL HOOKS ARE CALLED UNCONDITIONALLY ABOVE.
  // We can safely return null here if not visible or if hostDevice is not set.
  if (!visible || !hostDevice) {
    return null;
  }

  const handleSelectTarget = (id: string) => {
    setSelectedTargetId(prev => (prev === id ? null : id));
  };

  const handleLinkExisting = async (targetDeviceId: string) => {
    if (!hostDevice.id) return;
    if (!isHostMedia && !isAllowedHost(hostDevice.type)) {
      Alert.alert('פעולה לא נתמכת', 'צימוד מדיה מותר אך ורק עבור מגן מכלול, אלעד ירוק ושן בינה.');
      return;
    }
    setLoading(true);
    try {
      const hostId = isHostMedia ? targetDeviceId : hostDevice.id;
      const mediaId = isHostMedia ? hostDevice.id : targetDeviceId;

      await linkDevices(hostId, mediaId, userRole === 'Kashpal' ? 'קשפ"ל' : 'קשר"ג');
      Alert.alert('הצלחה', 'הצימוד בוצע בהצלחה!');
      onLinked();
      onClose();
    } catch (error: any) {
      console.error("Error linking devices:", error);
      Alert.alert('שגיאה', error?.message || 'לא ניתן לקשר את המכשירים. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndLink = async () => {
    if (!hostDevice.id || !searchTsadi.trim()) return;
    if (!isHostMedia && !isAllowedHost(hostDevice.type)) {
      Alert.alert('פעולה לא נתמכת', 'צימוד מדיה מותר אך ורק עבור מגן מכלול, אלעד ירוק ושן בינה.');
      return;
    }

    if (conflictDevice) {
      Alert.alert(
        'צ׳ כפול במצבה',
        `מספר צ׳ ${conflictDevice.tsadiNumber} כבר שייך ל-${conflictDevice.type} (ב-${conflictDevice.assignment || 'ללא שיוך'}).`
      );
      return;
    }

    setLoading(true);
    try {
      const createdType = isHostMedia ? 'מגן מכלול' : 'מדיה';
      const newDeviceData = {
        type: createdType,
        tsadiNumber: searchTsadi.trim(),
        assignment: hostDevice.assignment || 'מחלקת קשר',
        location: hostDevice.location || '',
        dohId: selectedDohId || hostDevice.dohId || ''
      };

      const newDeviceId = await addDevice(newDeviceData);
      const hostId = isHostMedia ? newDeviceId : hostDevice.id;
      const mediaId = isHostMedia ? hostDevice.id : newDeviceId;

      await linkDevices(hostId, mediaId, userRole === 'Kashpal' ? 'קשפ"ל' : 'קשר"ג');

      Alert.alert('הצלחה', `${createdType} חדש (צ' ${searchTsadi.trim()}) נוצר וקושר בהצלחה!`);
      onLinked();
      onClose();
    } catch (error: any) {
      console.error("Error creating and linking device:", error);
      Alert.alert('שגיאה', error?.message || 'שגיאה ביצירת וקישור המכשיר.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!hostDevice?.id) return;
    const currentDeviceId = hostDevice.id;

    const performUnlink = async () => {
      setLoading(true);
      try {
        await unlinkDevices(currentDeviceId, userRole === 'Kashpal' ? 'קשפ"ל' : 'קשר"ג');
        Alert.alert('הצלחה', 'הצימוד נותק בהצלחה.');
        onLinked();
        onClose();
      } catch (error) {
        console.error("Error unlinking device:", error);
        Alert.alert('שגיאה', 'לא ניתן לנתק את הצימוד.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('האם אתה בטוח שברצונך לנתק את הצימוד בין המכשירים?')) {
        await performUnlink();
      }
      return;
    }

    Alert.alert(
      'ניתוק צימוד',
      'האם לנתק את הצימוד בין המכשירים?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'נתק', style: 'destructive', onPress: performUnlink }
      ]
    );
  };

  const renderCandidateCard = (item: Device) => {
    const isSelected = selectedTargetId === item.id || exactMatch?.id === item.id;
    const isCurrentLinked = hostDevice.linkedDeviceId === item.id;
    const isOccupied = Boolean(item.linkedTsadi || item.linkedDeviceId);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.mediaCard,
          isSelected && styles.mediaCardSelected,
          isCurrentLinked && styles.mediaCardCurrent
        ]}
        onPress={() => item.id && handleSelectTarget(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.mediaCardRight}>
          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
            {isSelected && <View style={styles.radioInnerCircle} />}
          </View>
          <View>
            <Text style={styles.mediaCardTsadi}>{item.type} • צ׳ {item.tsadiNumber}</Text>
            <Text style={styles.mediaCardMeta}>
              {item.assignment || 'ללא שיוך'}{item.location ? ` • ${item.location}` : ''}
            </Text>
          </View>
        </View>

        {isOccupied ? (
          <View style={styles.alreadyLinkedBadge}>
            <Text style={styles.alreadyLinkedText}>
              מחובר ל-צ׳ {item.linkedTsadi}
            </Text>
          </View>
        ) : (
          <View style={styles.availableBadge}>
            <Feather name="check" size={10} color="#15803D" style={{ marginLeft: 3 }} />
            <Text style={styles.availableText}>פנויה במחסן</Text>
          </View>
        )}
      </TouchableOpacity>
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
                  <MaterialCommunityIcons name="link-variant" size={20} color="#0284C7" />
                </View>
                <Text style={styles.title}>
                  {isHostMedia ? 'צימוד מדיה למכשיר מארח' : 'צימוד מדיה למכשיר'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="סגור">
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Host Device Information */}
            <View style={styles.hostCard}>
              <View style={styles.hostCardRow}>
                <Text style={styles.hostType}>{hostDevice.type}</Text>
                <View style={styles.tsadiBadge}>
                  <Text style={styles.tsadiText}>צ׳ {hostDevice.tsadiNumber}</Text>
                </View>
              </View>
              <Text style={styles.hostMetaText}>
                שיוך: {hostDevice.assignment || 'ללא שיוך'}{hostDevice.location ? ` • ${hostDevice.location}` : ''}
              </Text>
            </View>

            {/* Current Link Status if already linked */}
            {hostDevice.linkedTsadi ? (
              <View style={styles.currentLinkBox}>
                <View style={styles.currentLinkHeader}>
                  <View style={styles.linkStatusPill}>
                    <Feather name="check-circle" size={12} color="#15803D" />
                    <Text style={styles.linkStatusPillText}>מחובר כעת</Text>
                  </View>
                  <Text style={styles.currentLinkLabel}>
                    {isHostMedia ? 'מכשיר מארח מקושר:' : 'מדיה מקושרת:'}
                  </Text>
                </View>

                <View style={styles.linkedItemRow}>
                  <View style={styles.linkedItemDetails}>
                    <Text style={styles.linkedItemTsadi}>צ׳ {hostDevice.linkedTsadi}</Text>
                    <Text style={styles.linkedItemType}>{hostDevice.linkedType || (isHostMedia ? 'מגן מכלול' : 'מדיה')}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.unlinkButton} 
                    onPress={handleUnlink}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Feather name="link-2" size={14} color="#DC2626" />
                    <Text style={styles.unlinkButtonText}>נתק צימוד</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Search or Enter Target Tsadi */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {hostDevice.linkedTsadi 
                  ? (isHostMedia ? 'החלף למכשיר מארח אחר:' : 'החלף למדיה אחרת:') 
                  : (isHostMedia ? 'בחר או הזן צ׳ שן בינה / מגן מכלול / אלעד לחיבור:' : 'בחר או הזן צ׳ מדיה לחיבור:')}
              </Text>
            </View>

            <View style={styles.searchContainer}>
              <Feather name="search" size={16} color="#94A3B8" style={{ marginLeft: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={isHostMedia ? "הקלד מספר צ׳ של המכשיר המארח (שן בינה / מגן מכלול)..." : "הקלד מספר צ׳ של המדיה..."}
                placeholderTextColor="#94A3B8"
                value={searchTsadi}
                onChangeText={setSearchTsadi}
                keyboardType="numeric"
                inputMode="numeric"
                textAlign="right"
              />
              {searchTsadi.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTsadi('')} style={{ padding: 4 }}>
                  <Feather name="x" size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Warning if Tsadi conflicts with an existing device of unexpected type */}
            {conflictDevice && (
              <View style={styles.conflictBox}>
                <Feather name="alert-triangle" size={16} color="#DC2626" style={{ marginLeft: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.conflictTitle}>
                    צ׳ {conflictDevice.tsadiNumber} כבר קיים במצבת הגדוד!
                  </Text>
                  <Text style={styles.conflictSub}>
                    הצ׳ שייך ל-{conflictDevice.type} (ב-{conflictDevice.assignment || 'ללא שיוך'}). לא ניתן להשתמש בו לצימוד זה.
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Create shortcut if user entered a Tsadi not found */}
            {searchTsadi.trim().length > 0 && !exactMatch && !conflictDevice && (
              <TouchableOpacity 
                style={styles.createAndLinkButton}
                onPress={handleCreateAndLink}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Feather name="plus-circle" size={16} color="#0284C7" style={{ marginLeft: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.createAndLinkText}>
                    הוסף {isHostMedia ? 'מגן מכלול' : 'מדיה'} (צ׳ {searchTsadi.trim()}) וקשר עכשיו
                  </Text>
                  <Text style={styles.createAndLinkSub}>
                    המכשיר ייווצר אוטומטית בפלוגה {hostDevice.assignment || 'מחלקת קשר'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* List of existing candidate options */}
            <View style={styles.mediaListContainer}>
              {searchTsadi.trim().length > 0 ? (
                <>
                  <Text style={styles.mediaListTitle}>
                    תוצאות חיפוש ({filteredCandidates.length}):
                  </Text>
                  {filteredCandidates.length === 0 ? (
                    <View style={styles.emptyListBox}>
                      <Text style={styles.emptyListText}>
                        לא נמצאה מדיה עם צ׳ "{searchTsadi.trim()}"
                      </Text>
                    </View>
                  ) : (
                    filteredCandidates.map((item) => renderCandidateCard(item))
                  )}
                </>
              ) : !isHostMedia ? (
                <>
                  {availableCandidates.length === 0 ? (
                    <View style={styles.noAvailableMediasBox}>
                      <View style={styles.noAvailableMediasIconCircle}>
                        <Feather name="package" size={22} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noAvailableMediasTitle}>אין מדיות פנויות במחסן</Text>
                        <Text style={styles.noAvailableMediasSub}>
                          כל המדיות הרשומות בגדוד כבר מקושרות למכשירים אחרים, או שטרם הוגדרו במערכת.
                        </Text>
                        <Text style={styles.noAvailableMediasInstruction}>
                          💡 הקלד מספר צ׳ של מדיה חדשה בתיבת החיפוש למעלה כדי להוסיף אותה ולקשרה ישירות למכשיר זה.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.mediaListTitle}>
                        מדיות פנויות במחסן ({availableCandidates.length}):
                      </Text>
                      {availableCandidates.map((item) => renderCandidateCard(item))}
                    </>
                  )}

                  {occupiedCandidates.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.mediaListTitle, { color: '#94A3B8' }]}>
                        מדיות תפוסות (מקושרות למכשירים אחרים):
                      </Text>
                      {occupiedCandidates.map((item) => renderCandidateCard(item))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.mediaListTitle}>
                    מכשירי שן בינה, מגני מכלול ואלעד ירוק בגדוד ({filteredCandidates.length}):
                  </Text>
                  {filteredCandidates.length === 0 ? (
                    <View style={styles.emptyListBox}>
                      <Text style={styles.emptyListText}>אין מכשירים מארחים זמינים במצבה</Text>
                    </View>
                  ) : (
                    filteredCandidates.map((item) => renderCandidateCard(item))
                  )}
                </>
              )}
            </View>

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <TouchableOpacity 
                style={[
                  styles.submitButton, 
                  (!selectedTargetId && !exactMatch) && styles.submitButtonDisabled
                ]}
                onPress={() => {
                  const targetId = selectedTargetId || exactMatch?.id;
                  if (targetId) handleLinkExisting(targetId);
                }}
                disabled={loading || (!selectedTargetId && !exactMatch)}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Feather name="link" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    <Text style={styles.submitButtonText}>
                      {hostDevice.linkedTsadi ? 'החלף צימוד' : 'קשר פריט נבחר'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>סגור</Text>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
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
  hostCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  hostCardRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hostType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  tsadiBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tsadiText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  hostMetaText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
  },

  currentLinkBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  currentLinkHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkStatusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  linkStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  currentLinkLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  linkedItemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkedItemDetails: {
    alignItems: 'flex-end',
  },
  linkedItemTsadi: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  linkedItemType: {
    fontSize: 12,
    color: '#64748B',
  },
  unlinkButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  unlinkButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: 'bold',
  },

  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },

  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },

  conflictBox: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  conflictTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#B91C1C',
    textAlign: 'right',
  },
  conflictSub: {
    fontSize: 11,
    color: '#DC2626',
    textAlign: 'right',
    marginTop: 2,
  },

  createAndLinkButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#38BDF8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  createAndLinkText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0284C7',
    textAlign: 'right',
  },
  createAndLinkSub: {
    fontSize: 11,
    color: '#0369A1',
    textAlign: 'right',
    marginTop: 1,
  },

  mediaListContainer: {
    marginTop: 6,
    marginBottom: 16,
  },
  mediaListTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 8,
  },
  emptyListBox: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 13,
    color: '#94A3B8',
  },

  noAvailableMediasBox: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  noAvailableMediasIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAvailableMediasTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'right',
    marginBottom: 4,
  },
  noAvailableMediasSub: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 6,
  },
  noAvailableMediasInstruction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
    textAlign: 'right',
  },

  mediaCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  mediaCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  mediaCardCurrent: {
    borderColor: '#10B981',
  },
  mediaCardRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#0284C7',
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7',
  },
  mediaCardTsadi: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  mediaCardMeta: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 1,
  },
  alreadyLinkedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alreadyLinkedText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  availableBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availableText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },

  bottomActions: {
    gap: 8,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
});
