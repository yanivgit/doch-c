import React, { useState, useEffect } from 'react';
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
  ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { addDevice } from '../firebase/api';
import { useApp } from '../context/AppContext';
import SearchableDropdown from './SearchableDropdown';

interface AddDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

interface RecentItem {
  id: string;
  type: string;
  tsadiNumber: string;
  assignment: string;
  location?: string;
  isOperational?: boolean;
}

const QUICK_TAGS = [
  'מ״ק 710',
  'אמר״ל',
  'סוללה חכמה',
  'אנטנה שוט',
  'ציר 62',
  'מחשב 55ג',
];

export default function AddDeviceModal({ visible, onClose, onAdded }: AddDeviceModalProps) {
  const { getAllEquipmentTypes, getAllPlatoons, getLocationsForPlatoon, learnNewOption, selectedDohId } = useApp();
  
  const [equipmentType, setEquipmentType] = useState('');
  const [tzadeNumber, setTzadeNumber] = useState('');
  const [pluga, setPluga] = useState('מחלקת קשר');
  const [location, setLocation] = useState('');
  const [isOperational, setIsOperational] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tsadiError, setTsadiError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTsadiError(null);
    }
  }, [visible]);

  // Recent items state with initial tactical sample records matching screenshot
  const [recentItems, setRecentItems] = useState<RecentItem[]>([
    {
      id: 'sample-1',
      type: 'מ״ק 710 ראשי',
      tsadiNumber: '742-9901',
      assignment: 'מחלקת קשר',
      location: 'מחסן קשר',
      isOperational: true,
    },
    {
      id: 'sample-2',
      type: 'סוללה ליתיום 24V',
      tsadiNumber: '104-5582',
      assignment: 'פלוגה א׳',
      location: 'עמדת טעינה',
      isOperational: true,
    },
  ]);

  const requiredFilledCount = (equipmentType.trim() ? 1 : 0) + (tzadeNumber.trim() ? 1 : 0);
  const isValid = requiredFilledCount === 2;

  const handleClear = () => {
    setEquipmentType('');
    setTzadeNumber('');
    setPluga('מחלקת קשר');
    setLocation('');
    setIsOperational(true);
    setTsadiError(null);
  };

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('שגיאה', 'אנא מלא את כל שדות החובה: סוג ציוד ומספר צ\'');
      return;
    }

    setLoading(true);
    setTsadiError(null);
    try {
      const faultStatus: 'replacement' | null = isOperational ? null : 'replacement';
      const newDeviceData = {
        type: equipmentType.trim(),
        tsadiNumber: tzadeNumber.trim(),
        assignment: pluga.trim() || 'מחלקת קשר',
        location: location.trim(),
        dohId: selectedDohId || '',
        faultStatus
      };

      const docId = await addDevice(newDeviceData);
      
      // Learn new dynamic options
      learnNewOption('equipment', equipmentType.trim());
      learnNewOption('platoon', pluga.trim() || 'מחלקת קשר');
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim() || 'מחלקת קשר');
      }

      // Add to recent items (at the top)
      setRecentItems(prev => [
        {
          id: docId || Date.now().toString(),
          type: newDeviceData.type,
          tsadiNumber: newDeviceData.tsadiNumber,
          assignment: newDeviceData.assignment,
          location: newDeviceData.location,
          isOperational,
        },
        ...prev
      ]);

      // Reset form state variables (type, tsadi, location) to empty strings
      setEquipmentType('');
      setTzadeNumber('');
      setLocation('');
      setPluga('מחלקת קשר');
      setIsOperational(true);
      setTsadiError(null);

      onAdded();
      Alert.alert('הצלחה', 'הציוד נוסף בהצלחה למאגר היחידתי');
    } catch (error: any) {
      console.error("Error adding device:", error);
      const errorMessage = error?.message || 'שגיאה בהוספת הציוד למאגר.';
      if (errorMessage.includes("קיים") || error?.message === 'DUPLICATE_TSADI') {
        const duplicateMsg = errorMessage.includes("קיים") ? errorMessage : "מכשיר עם צ' זה כבר קיים במצבת הגדוד.";
        setTsadiError(duplicateMsg);
        Alert.alert('שגיאה', duplicateMsg);
      } else {
        Alert.alert('שגיאה', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        
        {/* 1. Header Top Bar */}
        <View style={styles.headerTop}>
          <View style={styles.headerTopRight}>
            <View style={styles.checkBadgeBox}>
              <MaterialCommunityIcons name="check-decagram" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerTitleColumn}>
              <Text style={styles.headerTopSubtitle}>דו"ח ציוד טקטי • מחזור א'</Text>
              <Text style={styles.headerTopTitle}>Add Equipment</Text>
            </View>
          </View>

          <View style={styles.headerTopLeft}>
            <TouchableOpacity style={styles.iconBtnClose} onPress={onClose}>
              <Feather name="log-out" size={20} color="#DC2626" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.userCircleBtn}>
              <Feather name="user" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView 
            style={styles.mainScroll} 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            
            {/* Top Operational Status Bar */}
            <View style={styles.systemStatusBar}>
              <View style={styles.systemStatusTag}>
                <Feather name="check" size={11} color="#FFFFFF" />
                <Text style={styles.systemStatusTagText}>אבטחת מערכת שלימה</Text>
              </View>
              <Text style={styles.systemStatusText}>גרסת 2.4 • מלא סנכרון</Text>
            </View>

            {/* 2. Main Form Card */}
            <View style={styles.formCard}>
              
              {/* Card Header Row */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleRight}>
                  <View style={styles.formIconBox}>
                    <MaterialCommunityIcons name="playlist-plus" size={24} color="#15803D" />
                  </View>
                  <View style={styles.cardTitleCol}>
                    <Text style={styles.cardTitleText}>הוספת ציוד חדש</Text>
                    <Text style={styles.cardSubtitleText}>רישום פריט למצבת היחידה</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.closeCardBtn} onPress={onClose}>
                  <Feather name="x" size={18} color="#1E293B" />
                </TouchableOpacity>
              </View>

              {/* Quick Tags Row */}
              <View style={styles.quickTagsSection}>
                <Text style={styles.quickTagsLabel}>מהיר:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTagsList}>
                  {QUICK_TAGS.map((tag) => (
                    <TouchableOpacity 
                      key={tag} 
                      style={[styles.quickTagPill, equipmentType === tag && styles.quickTagPillActive]}
                      onPress={() => setEquipmentType(tag)}
                    >
                      <Text style={[styles.quickTagText, equipmentType === tag && styles.quickTagTextActive]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Field 1: Equipment Type (חובה) */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabelText}>
                    <Text style={styles.requiredStar}>* </Text>סוג ציוד
                  </Text>
                  <Text style={styles.fieldHintText}>קטלוג פעיל</Text>
                </View>

                <SearchableDropdown
                  data={getAllEquipmentTypes()}
                  value={equipmentType}
                  onSelect={setEquipmentType}
                  placeholder="חפש ובחר סוג ציוד..."
                  allowFreeText={true}
                />
              </View>

              {/* Field 2: Tsadi Number (חובה) */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabelText}>
                    <Text style={styles.requiredStar}>* </Text>מספר צ׳ / מזהה
                  </Text>
                  <Text style={styles.fieldHintText}>סריקה אופטית זמינה</Text>
                </View>

                <View style={[styles.inputContainerWithActions, tsadiError ? styles.inputErrorBorder : null]}>
                  <View style={styles.inputRightSection}>
                    <MaterialIcons name="keyboard" size={18} color="#64748B" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputRTL}
                      placeholder="צ׳ - (לדוגמה: 849-284)"
                      placeholderTextColor="#94A3B8"
                      value={tzadeNumber}
                      onChangeText={(val) => {
                        setTzadeNumber(val);
                        if (tsadiError) setTsadiError(null);
                      }}
                      textAlign="right"
                      keyboardType="default"
                    />
                  </View>

                  <TouchableOpacity 
                    style={styles.barcodeScanBtn} 
                    onPress={() => Alert.alert('סריקה אופטית', 'מצלמת הסריקה מוכנה לקליטת ברקוד / QR')}
                  >
                    <MaterialCommunityIcons name="barcode-scan" size={18} color="#4F46E5" />
                  </TouchableOpacity>
                </View>

                {tsadiError ? (
                  <View style={styles.errorRow}>
                    <Feather name="alert-circle" size={13} color="#DC2626" />
                    <Text style={styles.errorText}>{tsadiError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Field 3: Platoon Assignment (שיוך) */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabelText}>שיוך לפלוגה / מחלקה</Text>
                  <Text style={styles.fieldHintText}>ברירת מחדל: מחלקת קשר</Text>
                </View>

                <SearchableDropdown
                  data={getAllPlatoons()}
                  value={pluga}
                  onSelect={(newPlatoon) => {
                    setPluga(newPlatoon);
                    setLocation('');
                  }}
                  placeholder="מחלקת קשר (ברירת מחדל)"
                />
              </View>

              {/* Field 4: Location / Role (מיקום) */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabelText}>מיקום / תפקיד</Text>
                  <Text style={styles.fieldHintText}>אופציונלי</Text>
                </View>

                <View style={styles.inputContainerSingle}>
                  <Feather name="map-pin" size={18} color="#64748B" style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInputRTL}
                    placeholder="בחר או הקלד מיקום (למשל: נגמ״ש פיקוד, מדף 4)"
                    placeholderTextColor="#94A3B8"
                    value={location}
                    onChangeText={setLocation}
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Initial Status Checkbox */}
              <TouchableOpacity 
                style={[styles.statusCheckboxCard, !isOperational && styles.statusCheckboxCardFaulty]}
                onPress={() => setIsOperational(!isOperational)}
                activeOpacity={0.8}
              >
                <View style={styles.statusCheckboxRight}>
                  <MaterialCommunityIcons 
                    name={isOperational ? "shield-check-outline" : "alert-octagon-outline"} 
                    size={22} 
                    color={isOperational ? "#15803D" : "#DC2626"} 
                  />
                  <View style={styles.statusCheckboxTexts}>
                    <Text style={[styles.statusCheckboxTitle, !isOperational && { color: '#B91C1C' }]}>
                      {isOperational ? 'מצב ראשוני: תקין ומוכן לפעילות' : 'מצב ראשוני: תקול (דורש החלפה)'}
                    </Text>
                    <Text style={styles.statusCheckboxSub}>
                      {isOperational ? 'מסומן כציוד זמין ותקין לשימוש' : 'יסומן באדום כציוד הדורש החלפה'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.customCheckbox, isOperational && styles.customCheckboxActive, !isOperational && styles.customCheckboxFaulty]}>
                  {isOperational ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : (
                    <Feather name="x" size={14} color="#DC2626" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Info Validation Banner */}
              <View style={styles.infoValidationBanner}>
                <View style={styles.infoValidationRight}>
                  <Feather name="info" size={15} color="#4F46E5" />
                  <Text style={styles.infoValidationText}>
                    מלא את שדות החובה כדי לאפשר רישום
                  </Text>
                </View>
                <View style={[styles.counterPill, isValid && styles.counterPillComplete]}>
                  <Text style={[styles.counterPillText, isValid && styles.counterPillTextComplete]}>
                    {requiredFilledCount}/2 חובה
                  </Text>
                </View>
              </View>

              {/* Main Submit Button */}
              <TouchableOpacity 
                style={[styles.submitButton, (!isValid || loading) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!isValid || loading}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {loading ? 'רושם במערכת...' : 'הוסף ציוד'}
                </Text>
              </TouchableOpacity>

              {/* Clear Fields Text Button */}
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Text style={styles.clearBtnText}>נקה שדות</Text>
              </TouchableOpacity>

            </View>

            {/* 3. Recent Items Section */}
            <View style={styles.recentSection}>
              <View style={styles.recentHeaderRow}>
                <View style={styles.recentHeaderRight}>
                  <MaterialCommunityIcons name="history" size={20} color="#0284C7" />
                  <Text style={styles.recentHeaderTitle}>פריטים שהוזנו לאחרונה</Text>
                </View>
                <Text style={styles.recentHeaderSubtitle}>אפשרות גיבוי</Text>
              </View>

              {recentItems.map((item) => (
                <View key={item.id || item.tsadiNumber} style={styles.recentCard}>
                  <View style={styles.recentCardRight}>
                    <View style={styles.recentCardIconBox}>
                      <MaterialCommunityIcons 
                        name={item.type.includes('סוללה') ? 'battery-charging-60' : 'broadcast'} 
                        size={20} 
                        color="#4F46E5" 
                      />
                    </View>
                    <View style={styles.recentCardTexts}>
                      <Text style={styles.recentItemTitle}>{item.type}</Text>
                      <Text style={styles.recentItemSub}>
                        {item.assignment} • SN: {item.tsadiNumber}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.okBadge}>
                    <Text style={styles.okBadgeText}>תקין</Text>
                  </View>
                </View>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* 4. Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={onClose}>
            <MaterialCommunityIcons name="archive-outline" size={22} color="#64748B" />
            <Text style={styles.navText}>קשפ"ל</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} activeOpacity={1}>
            <Feather name="plus-circle" size={20} color="#15803D" />
            <Text style={[styles.navText, styles.navTextActive]}>הוספת ציוד</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={onClose}>
            <Feather name="clock" size={20} color="#64748B" />
            <Text style={styles.navText}>ציר זמן</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={onClose}>
            <MaterialIcons name="badge" size={22} color="#64748B" />
            <Text style={styles.navText}>כניסה</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  /* Header Top */
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBadgeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    alignItems: 'flex-start',
  },
  headerTopSubtitle: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
    fontWeight: '500',
  },
  headerTopTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  headerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnClose: {
    padding: 6,
  },
  userCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E6B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* System Status Bar */
  systemStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  systemStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  systemStatusTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  systemStatusText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Main Form Card */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleCol: {
    alignItems: 'flex-start',
  },
  cardTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  closeCardBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Quick Tags */
  quickTagsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 2,
  },
  quickTagsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  quickTagsList: {
    flexDirection: 'row',
    gap: 6,
  },
  quickTagPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  quickTagPillActive: {
    backgroundColor: '#1E6B3A',
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  quickTagTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Field Blocks */
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '900',
  },
  fieldHintText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },

  /* Inputs */
  inputContainerWithActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 48,
    marginBottom: 4,
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'right',
  },
  inputRightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainerSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 48,
    gap: 8,
    marginBottom: 4,
  },
  inputLeadingIcon: {
    marginLeft: 4,
  },
  textInputRTL: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  barcodeScanBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Status Checkbox */
  statusCheckboxCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FE',
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  statusCheckboxCardFaulty: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusCheckboxRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusCheckboxTexts: {
    alignItems: 'flex-start',
  },
  statusCheckboxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusCheckboxSub: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
    marginTop: 1,
  },
  customCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  customCheckboxActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  customCheckboxFaulty: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },

  /* Info Validation */
  infoValidationBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 14,
  },
  infoValidationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValidationText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '600',
  },
  counterPill: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  counterPillComplete: {
    backgroundColor: '#DCFCE7',
  },
  counterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  counterPillTextComplete: {
    color: '#15803D',
  },

  /* Submit Button */
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E6B3A',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#1E6B3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#A7F3D0',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },

  /* Recent Items Section */
  recentSection: {
    marginBottom: 16,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  recentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  recentCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recentCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCardTexts: {
    alignItems: 'flex-start',
  },
  recentItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  okBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  okBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },

  /* Bottom Navigation */
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
  },
  navText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  navTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
});
