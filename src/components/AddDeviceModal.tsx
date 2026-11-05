import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  addDevice, 
  Device, 
  linkDevices, 
  findDeviceByTsadi, 
  createShakedKit, 
  getAllDevices,
  ShakedKitSlotInput 
} from '../firebase/api';
import { useApp } from '../context/AppContext';
import SearchableDropdown from './SearchableDropdown';
import { isShakedKitType } from '../utils';

interface AddDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  allDevices?: Device[];
}

export default function AddDeviceModal({ visible, onClose, onAdded, allDevices = [] }: AddDeviceModalProps) {
  const { 
    userRole,
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
  const [notes, setNotes] = useState('');
  const [mediaTsadi, setMediaTsadi] = useState('');
  const [loading, setLoading] = useState(false);
  const [tsadiError, setTsadiError] = useState<string | null>(null);

  // Internal devices state if allDevices wasn't passed by parent
  const [internalDevices, setInternalDevices] = useState<Device[]>([]);
  const effectiveDevices = allDevices && allDevices.length > 0 ? allDevices : internalDevices;

  // Shaked Kit dedicated slot state
  const [kitName, setKitName] = useState('');
  const [tel100Mode, setTel100Mode] = useState<'new' | 'existing'>('new');
  const [tel100Tsadi, setTel100Tsadi] = useState('');
  const [tel100SelectedId, setTel100SelectedId] = useState<string | null>(null);

  const [mabanMode, setMabanMode] = useState<'new' | 'existing'>('new');
  const [mabanTsadi, setMabanTsadi] = useState('');
  const [mabanSelectedId, setMabanSelectedId] = useState<string | null>(null);

  const [tabletMode, setTabletMode] = useState<'new' | 'existing'>('new');
  const [tabletTsadi, setTabletTsadi] = useState('');
  const [tabletSelectedId, setTabletSelectedId] = useState<string | null>(null);

  // Keep track of devices added in this modal session
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);

  // Ref to manually focus the tzade input after submission
  const tzadeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTsadiError(null);
      if ((!allDevices || allDevices.length === 0) && selectedDohId) {
        getAllDevices(selectedDohId).then(setInternalDevices).catch(() => {});
      }
    }
  }, [visible, allDevices, selectedDohId]);

  const isShakedKit = isShakedKitType(equipmentType);

  // Available existing devices not yet assigned to any kit
  const availableTel100 = useMemo(() => {
    return effectiveDevices.filter(d => 
      (d.type || '').toLowerCase().includes('טל 100') && !d.parentKitId
    );
  }, [effectiveDevices]);

  const availableMaban = useMemo(() => {
    return effectiveDevices.filter(d => {
      const t = (d.type || '').toLowerCase();
      return t.includes('מבן') && !t.includes('חישה') && !d.parentKitId;
    });
  }, [effectiveDevices]);

  const availableTablet = useMemo(() => {
    return effectiveDevices.filter(d => 
      (d.type || '').toLowerCase().includes('טאבלט') && !d.parentKitId
    );
  }, [effectiveDevices]);

  const isValid = isShakedKit 
    ? true 
    : (equipmentType.trim() !== '' && tzadeNumber.trim() !== '');

  const handleShakedKitSubmit = async () => {
    setLoading(true);
    setTsadiError(null);

    try {
      // 1. Check duplicate between newly entered Tsadis in this kit
      const newTsadis = [
        tel100Mode === 'new' ? tel100Tsadi.trim() : '',
        mabanMode === 'new' ? mabanTsadi.trim() : '',
        tabletMode === 'new' ? tabletTsadi.trim() : '',
      ].filter(Boolean);

      const uniqueNewTsadis = new Set(newTsadis);
      if (uniqueNewTsadis.size !== newTsadis.length) {
        Alert.alert('צ׳ כפול בערכה', 'הזנת את אותו מספר צ\' עבור יותר מרכיב אחד בתוך ערכת השקד.');
        setLoading(false);
        return;
      }

      let tel100Slot: ShakedKitSlotInput | undefined;
      if (tel100Mode === 'new' && tel100Tsadi.trim()) {
        const cleanT = tel100Tsadi.trim();
        const existing = effectiveDevices.find(d => (d.tsadiNumber || '').trim().toLowerCase() === cleanT.toLowerCase());
        if (existing) {
          tel100Slot = { mode: 'existing', tsadiNumber: existing.tsadiNumber, deviceId: existing.id };
        } else {
          tel100Slot = { mode: 'new', tsadiNumber: cleanT };
        }
      } else if (tel100Mode === 'existing' && tel100SelectedId) {
        const dev = effectiveDevices.find(d => d.id === tel100SelectedId);
        if (dev) tel100Slot = { mode: 'existing', tsadiNumber: dev.tsadiNumber, deviceId: dev.id };
      }

      let mabanSlot: ShakedKitSlotInput | undefined;
      if (mabanMode === 'new' && mabanTsadi.trim()) {
        const cleanM = mabanTsadi.trim();
        const existing = effectiveDevices.find(d => (d.tsadiNumber || '').trim().toLowerCase() === cleanM.toLowerCase());
        if (existing) {
          mabanSlot = { mode: 'existing', tsadiNumber: existing.tsadiNumber, deviceId: existing.id };
        } else {
          mabanSlot = { mode: 'new', tsadiNumber: cleanM };
        }
      } else if (mabanMode === 'existing' && mabanSelectedId) {
        const dev = effectiveDevices.find(d => d.id === mabanSelectedId);
        if (dev) mabanSlot = { mode: 'existing', tsadiNumber: dev.tsadiNumber, deviceId: dev.id };
      }

      let tabletSlot: ShakedKitSlotInput | undefined;
      if (tabletMode === 'new' && tabletTsadi.trim()) {
        const cleanTab = tabletTsadi.trim();
        const existing = effectiveDevices.find(d => (d.tsadiNumber || '').trim().toLowerCase() === cleanTab.toLowerCase());
        if (existing) {
          tabletSlot = { mode: 'existing', tsadiNumber: existing.tsadiNumber, deviceId: existing.id };
        } else {
          tabletSlot = { mode: 'new', tsadiNumber: cleanTab };
        }
      } else if (tabletMode === 'existing' && tabletSelectedId) {
        const dev = effectiveDevices.find(d => d.id === tabletSelectedId);
        if (dev) tabletSlot = { mode: 'existing', tsadiNumber: dev.tsadiNumber, deviceId: dev.id };
      }

      const cleanName = kitName.trim() || 'ערכת שקד';

      const kitId = await createShakedKit({
        kitName: cleanName,
        assignment: pluga.trim() || 'מחלקת קשר',
        location: location.trim(),
        dohId: selectedDohId || '',
        notes: notes.trim() || undefined,
        tel100: tel100Slot,
        maban: mabanSlot,
        tablet: tabletSlot
      }, userRole ? 'קשר"ג' : undefined);

      // Metadata learning
      learnNewOption('equipment', 'ערכת שקד');
      learnNewOption('platoon', pluga.trim() || 'מחלקת קשר');
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim() || 'מחלקת קשר');
      }

      // Add to local session list (at the top)
      const telTsadiDisplay = tel100Slot?.tsadiNumber || '';
      const mabanTsadiDisplay = mabanSlot?.tsadiNumber || '';
      const tabletTsadiDisplay = tabletSlot?.tsadiNumber || '';

      setRecentDevices(prev => [{
        id: kitId,
        type: 'ערכת שקד',
        kitName: cleanName,
        isKit: true,
        tsadiNumber: `3 פריטים`,
        assignment: pluga.trim() || 'מחלקת קשר',
        location: location.trim(),
        dohId: selectedDohId || '',
        tel100Tsadi: telTsadiDisplay,
        mabanTsadi: mabanTsadiDisplay,
        tabletTsadi: tabletTsadiDisplay,
      }, ...prev]);

      // Reset kit fields
      setKitName('');
      setTel100Mode('new');
      setTel100Tsadi('');
      setTel100SelectedId(null);
      setMabanMode('new');
      setMabanTsadi('');
      setMabanSelectedId(null);
      setTabletMode('new');
      setTabletTsadi('');
      setTabletSelectedId(null);
      setNotes('');
      setTsadiError(null);

      // Notify parent screen
      onAdded();
    } catch (error: any) {
      console.error("Error adding Shaked kit:", error);
      Alert.alert('שגיאה', error?.message || 'שגיאה בהוספת ערכת שקד. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isShakedKit) {
      await handleShakedKitSubmit();
      return;
    }

    if (!isValid) {
      Alert.alert('שדות חובה חסרים', 'אנא מלא סוג ציוד ומספר צ\' כדי להוסיף את המכשיר.');
      return;
    }

    setLoading(true);
    setTsadiError(null);

    try {
      const cleanMainTsadi = tzadeNumber.trim();
      const cleanMediaTsadi = mediaTsadi.trim();

      // Check conflict between main device and media input
      if (cleanMediaTsadi && cleanMediaTsadi === cleanMainTsadi) {
        Alert.alert('שגיאה', 'לא ניתן להזין את אותו מספר צ\' עבור המכשיר והמדיה.');
        setLoading(false);
        return;
      }

      // Pre-validate media Tsadi if entered
      let existingMediaDevice: Device | null = null;
      if (cleanMediaTsadi) {
        existingMediaDevice = await findDeviceByTsadi(cleanMediaTsadi, selectedDohId || undefined);
        if (existingMediaDevice) {
          const mediaType = (existingMediaDevice.type || '').toLowerCase();
          if (!mediaType.includes('מדיה') && !mediaType.includes('נתיק')) {
            Alert.alert(
              'צ׳ כפול במצבה',
              `מספר צ׳ ${cleanMediaTsadi} כבר שייך במצבה ל-${existingMediaDevice.type} (ב-${existingMediaDevice.assignment || 'ללא שיוך'}). לא ניתן לקשר אותו כמדיה.`
            );
            setLoading(false);
            return;
          }
        }
      }

      const newDeviceData: any = {
        type: equipmentType.trim(),
        tsadiNumber: cleanMainTsadi,
        assignment: pluga.trim() || 'מחלקת קשר',
        location: location.trim(),
        dohId: selectedDohId || ''
      };
      if (notes.trim()) {
        newDeviceData.notes = notes.trim();
      }

      const id = await addDevice(newDeviceData);
      
      // Auto-link media if entered for Magen Michlol / Elad Yarok / Shen Bina
      if (cleanMediaTsadi) {
        try {
          let mediaId = existingMediaDevice?.id;
          if (!mediaId) {
            mediaId = await addDevice({
              type: 'מדיה',
              tsadiNumber: cleanMediaTsadi,
              assignment: newDeviceData.assignment,
              location: newDeviceData.location,
              dohId: selectedDohId || ''
            });
          }
          await linkDevices(id, mediaId, 'קשר"ג');
        } catch (mediaErr: any) {
          console.error("Error auto-linking media during device addition:", mediaErr);
          Alert.alert('שים לב', mediaErr?.message || 'המכשיר נוצר, אך שגיאה אירעה בעת צימוד המדיה.');
        }
      }

      // Dynamic metadata learning
      learnNewOption('equipment', equipmentType.trim());
      learnNewOption('platoon', pluga.trim() || 'מחלקת קשר');
      if (location.trim()) {
        learnNewOption('location', location.trim(), pluga.trim() || 'מחלקת קשר');
      }

      // Add to local session list (at the top)
      setRecentDevices(prev => [{ id, ...newDeviceData }, ...prev]);
      
      // Rapid entry workflow: clear Tsadi, Pluga, Location, Notes
      setTzadeNumber('');
      setPluga('');
      setLocation('');
      setNotes('');
      setMediaTsadi('');
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
                  <Text style={styles.formSubtitle}>הזן נתונים ולחץ "הוסף למצבה" למעבר מיידי למכשיר הבא</Text>
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
                  placeholder="חפש ובחר סוג ציוד (למשל ערכת שקד, מגן מכלול, נייד 710)..."
                  allowFreeText={true}
                />
              </View>

              {/* SPECIALIZED VIEW: Shaked Kit 3 Slots */}
              {isShakedKit ? (
                <View style={styles.kitSpecialCard}>
                  <View style={styles.kitSpecialHeader}>
                    <View style={styles.kitSpecialHeaderIcon}>
                      <MaterialCommunityIcons name="toolbox" size={18} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kitSpecialTitle}>הוספת ערכת שקד (ללא צורך בצ׳ לערכה)</Text>
                      <Text style={styles.kitSpecialSub}>ניתן להוסיף ערכה ריקה ולחבר אליה מכשירים אחר כך מתוך הרשימה, או לשייך אליה מכשירים (טל 100, מבן, טאבלט) כבר עכשיו:</Text>
                    </View>
                  </View>

                  {/* Kit Name (Optional) */}
                  <View style={styles.inputGroupSmall}>
                    <Text style={styles.kitSlotHeaderLabel}>כינוי / שם לערכה (אופציונלי):</Text>
                    <TextInput
                      style={styles.kitSlotInput}
                      placeholder='למשל: ערכת שקד 1, שקד עמדת מ"פ...'
                      placeholderTextColor="#94A3B8"
                      value={kitName}
                      onChangeText={setKitName}
                      textAlign="right"
                    />
                  </View>

                  {/* SLOT 1: טל 100 */}
                  <View style={styles.slotCard}>
                    <View style={styles.slotHeaderRow}>
                      <View style={styles.slotLabelRow}>
                        <Feather name="phone" size={13} color="#0284C7" />
                        <Text style={styles.slotLabelText}>1. טל 100</Text>
                      </View>
                      <View style={styles.modeToggleGroup}>
                        <TouchableOpacity 
                          style={[styles.modeToggleBtn, tel100Mode === 'new' && styles.modeToggleBtnActive]}
                          onPress={() => setTel100Mode('new')}
                        >
                          <Text style={[styles.modeToggleText, tel100Mode === 'new' && styles.modeToggleTextActive]}>
                            + צ׳ חדש
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modeToggleBtn, tel100Mode === 'existing' && styles.modeToggleBtnActive]}
                          onPress={() => setTel100Mode('existing')}
                        >
                          <Text style={[styles.modeToggleText, tel100Mode === 'existing' && styles.modeToggleTextActive]}>
                            מהמצבה ({availableTel100.length})
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {tel100Mode === 'new' ? (
                      <TextInput
                        style={styles.kitSlotInput}
                        placeholder="הקלד צ׳ של הטל 100..."
                        placeholderTextColor="#94A3B8"
                        value={tel100Tsadi}
                        onChangeText={setTel100Tsadi}
                        keyboardType="numeric"
                        inputMode="numeric"
                        textAlign="right"
                      />
                    ) : (
                      <View>
                        {availableTel100.length === 0 ? (
                          <Text style={styles.noAvailableText}>אין טל 100 פנוי במצבה (בחר בצ׳ חדש)</Text>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devicesScroll}>
                            {availableTel100.map(item => (
                              <TouchableOpacity
                                key={item.id}
                                style={[styles.devicePill, tel100SelectedId === item.id && styles.devicePillSelected]}
                                onPress={() => setTel100SelectedId(item.id || null)}
                              >
                                <Text style={[styles.devicePillText, tel100SelectedId === item.id && styles.devicePillTextSelected]}>
                                  צ׳ {item.tsadiNumber} ({item.assignment})
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>

                  {/* SLOT 2: מבן */}
                  <View style={styles.slotCard}>
                    <View style={styles.slotHeaderRow}>
                      <View style={styles.slotLabelRow}>
                        <MaterialCommunityIcons name="power-plug" size={14} color="#0284C7" />
                        <Text style={styles.slotLabelText}>2. מבן</Text>
                      </View>
                      <View style={styles.modeToggleGroup}>
                        <TouchableOpacity 
                          style={[styles.modeToggleBtn, mabanMode === 'new' && styles.modeToggleBtnActive]}
                          onPress={() => setMabanMode('new')}
                        >
                          <Text style={[styles.modeToggleText, mabanMode === 'new' && styles.modeToggleTextActive]}>
                            + צ׳ חדש
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modeToggleBtn, mabanMode === 'existing' && styles.modeToggleBtnActive]}
                          onPress={() => setMabanMode('existing')}
                        >
                          <Text style={[styles.modeToggleText, mabanMode === 'existing' && styles.modeToggleTextActive]}>
                            מהמצבה ({availableMaban.length})
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {mabanMode === 'new' ? (
                      <TextInput
                        style={styles.kitSlotInput}
                        placeholder="הקלד צ׳ של המבן..."
                        placeholderTextColor="#94A3B8"
                        value={mabanTsadi}
                        onChangeText={setMabanTsadi}
                        keyboardType="numeric"
                        inputMode="numeric"
                        textAlign="right"
                      />
                    ) : (
                      <View>
                        {availableMaban.length === 0 ? (
                          <Text style={styles.noAvailableText}>אין מבן פנוי במצבה (בחר בצ׳ חדש)</Text>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devicesScroll}>
                            {availableMaban.map(item => (
                              <TouchableOpacity
                                key={item.id}
                                style={[styles.devicePill, mabanSelectedId === item.id && styles.devicePillSelected]}
                                onPress={() => setMabanSelectedId(item.id || null)}
                              >
                                <Text style={[styles.devicePillText, mabanSelectedId === item.id && styles.devicePillTextSelected]}>
                                  צ׳ {item.tsadiNumber} ({item.assignment})
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>

                  {/* SLOT 3: טאבלט */}
                  <View style={styles.slotCard}>
                    <View style={styles.slotHeaderRow}>
                      <View style={styles.slotLabelRow}>
                        <Feather name="tablet" size={13} color="#0284C7" />
                        <Text style={styles.slotLabelText}>3. טאבלט</Text>
                      </View>
                      <View style={styles.modeToggleGroup}>
                        <TouchableOpacity 
                          style={[styles.modeToggleBtn, tabletMode === 'new' && styles.modeToggleBtnActive]}
                          onPress={() => setTabletMode('new')}
                        >
                          <Text style={[styles.modeToggleText, tabletMode === 'new' && styles.modeToggleTextActive]}>
                            + צ׳ חדש
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modeToggleBtn, tabletMode === 'existing' && styles.modeToggleBtnActive]}
                          onPress={() => setTabletMode('existing')}
                        >
                          <Text style={[styles.modeToggleText, tabletMode === 'existing' && styles.modeToggleTextActive]}>
                            מהמצבה ({availableTablet.length})
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {tabletMode === 'new' ? (
                      <TextInput
                        style={styles.kitSlotInput}
                        placeholder="הקלד צ׳ של הטאבלט..."
                        placeholderTextColor="#94A3B8"
                        value={tabletTsadi}
                        onChangeText={setTabletTsadi}
                        keyboardType="numeric"
                        inputMode="numeric"
                        textAlign="right"
                      />
                    ) : (
                      <View>
                        {availableTablet.length === 0 ? (
                          <Text style={styles.noAvailableText}>אין טאבלט פנוי במצבה (בחר בצ׳ חדש)</Text>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devicesScroll}>
                            {availableTablet.map(item => (
                              <TouchableOpacity
                                key={item.id}
                                style={[styles.devicePill, tabletSelectedId === item.id && styles.devicePillSelected]}
                                onPress={() => setTabletSelectedId(item.id || null)}
                              >
                                <Text style={[styles.devicePillText, tabletSelectedId === item.id && styles.devicePillTextSelected]}>
                                  צ׳ {item.tsadiNumber} ({item.assignment})
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                /* Field 2: Standard Tsadi Number */
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
                    keyboardType="numeric"
                    inputMode="numeric"
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
              )}

              {/* Field 3: Platoon Assignment */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.optionalTag}>ברירת מחדל: מחלקת קשר</Text>
                  <Text style={styles.label}>שיוך לפלוגה</Text>
                </View>
                <SearchableDropdown
                  data={getAllPlatoons()}
                  value={pluga}
                  onSelect={(selected) => {
                    const clean = selected.trim();
                    setPluga(clean);
                    if (clean && clean !== 'מחלקת קשר' && clean !== 'ללא שיוך') {
                      learnNewOption('platoon', clean);
                    }
                  }}
                  placeholder="בחר או הקלד פלוגה חדשה..."
                  allowFreeText={true}
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

              {/* Optional Field: Media Tsadi for Magen Michlol / Elad Yarok / Shen Bina */}
              {!isShakedKit && (equipmentType.includes('מגן') || equipmentType.includes('אלעד') || equipmentType.includes('שן בינה') || equipmentType.includes('בינה')) && (
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.optionalTag}>אופציונלי • צימוד אוטומטי</Text>
                    <Text style={styles.label}>צ׳ מדיה מחוברת</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { height: 44 }]}
                    placeholder="הקלד צ׳ מדיה לצימוד מיידי..."
                    placeholderTextColor="#94A3B8"
                    value={mediaTsadi}
                    onChangeText={setMediaTsadi}
                    keyboardType="numeric"
                    inputMode="numeric"
                    textAlign="right"
                  />
                </View>
              )}

              {/* Field 5: Notes */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.optionalTag}>אופציונלי • קשר"ג בלבד</Text>
                  <Text style={styles.label}>הערה לציוד</Text>
                </View>
                <TextInput
                  style={[styles.input, { height: 44 }]}
                  placeholder="הוסף הערה (למשל: במקור פלוגה ב)..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  maxLength={500}
                  textAlign="right"
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
                    {isShakedKit ? (
                      <>
                        <MaterialCommunityIcons name="toolbox" size={18} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>הוסף ערכת שקד למצבה</Text>
                      </>
                    ) : (
                      <>
                        <Feather name="plus-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>הוסף מכשיר למצבה</Text>
                      </>
                    )}
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
                          <Text style={styles.recentType}>{device.isKit ? (device.kitName || 'ערכת שקד') : device.type}</Text>
                          <View style={[styles.recentTsadiBadge, device.isKit && { backgroundColor: '#E0F2FE' }]}>
                            <Text style={[styles.recentTsadiText, device.isKit && { color: '#0284C7' }]}>
                              {device.isKit ? 'מארז (3 צ\')' : `צ׳ ${device.tsadiNumber}`}
                            </Text>
                          </View>
                        </View>
                        {device.isKit && (
                          <Text style={styles.recentKitSlotsText}>
                            {`טל 100: ${device.tel100Tsadi ? `צ' ${device.tel100Tsadi}` : 'חסר'} • מבן: ${device.mabanTsadi ? `צ' ${device.mabanTsadi}` : 'חסר'} • טאבלט: ${device.tabletTsadi ? `צ' ${device.tabletTsadi}` : 'חסר'}`}
                          </Text>
                        )}
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
    gap: 4,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  stepBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  closeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },

  /* Form Card */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  formCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  formHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderTitles: {
    flex: 1,
    alignItems: 'flex-end',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  formSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputGroupSmall: {
    marginBottom: 10,
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
  },
  requiredStar: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginRight: 4,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlign: 'right',
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'right',
  },

  /* Specialized Shaked Kit Card */
  kitSpecialCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  kitSpecialHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
    paddingBottom: 10,
  },
  kitSpecialHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kitSpecialTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
    textAlign: 'right',
  },
  kitSpecialSub: {
    fontSize: 11,
    color: '#0284C7',
    textAlign: 'right',
    marginTop: 1,
  },
  kitSlotHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
    textAlign: 'right',
    marginBottom: 5,
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  slotHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  slotLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modeToggleGroup: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  modeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modeToggleBtnActive: {
    backgroundColor: '#0284C7',
  },
  modeToggleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kitSlotInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlign: 'right',
  },
  devicesScroll: {
    flexDirection: 'row-reverse',
    gap: 6,
    paddingVertical: 2,
  },
  devicePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  devicePillSelected: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  devicePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  devicePillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  noAvailableText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    paddingVertical: 4,
    fontStyle: 'italic',
  },
  recentKitSlotsText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 2,
  },

  addButton: {
    backgroundColor: '#15803D',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Recently Added Section */
  recentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
  recentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  emptyRecentBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyRecentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyRecentSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  recentCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {
    flex: 1,
  },
  recentInfoTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  recentTsadiBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentTsadiText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  recentAssignment: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  moreText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },

  /* Tactical Footer */
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  finishButton: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  finishButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
