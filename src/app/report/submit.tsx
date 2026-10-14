import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import Snackbar from '../../components/Snackbar';
import SearchableDropdown from '../../components/SearchableDropdown';
import OfflineBanner from '../../components/OfflineBanner';

const REPORT_TYPES = [
  'תקלה טכנית',
  'בקשת חלפים',
  'עדכון כוח אדם',
  'דיווח יומי - סיכום',
  'אחר'
];

const DRAFT_STORAGE_KEY = '@report_draft';

export default function SubmitReportScreen() {
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draftStr = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          if (draft.title) setTitle(draft.title);
          if (draft.description) setDescription(draft.description);
          if (draft.reportType) setReportType(draft.reportType);
        }
      } catch (e) {
        console.error('Error loading draft', e);
      } finally {
        setIsInitializing(false);
      }
    };
    loadDraft();
  }, []);

  // Save draft on changes
  useEffect(() => {
    if (isInitializing) return;
    const saveDraft = async () => {
      try {
        const draft = { title, description, reportType };
        await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.error('Error saving draft', e);
      }
    };
    saveDraft();
  }, [title, description, reportType, isInitializing]);

  const isValid = title.trim() !== '' && description.trim() !== '' && reportType.trim() !== '';

  const handleSubmit = async () => {
    if (!isValid) {
      setSnackbarMessage('אנא מלא את כל שדות החובה המסומנים בכוכבית');
      setSnackbarVisible(true);
      return;
    }

    setIsLoading(true);
    
    // Simulate network request or firebase submission
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    setIsLoading(false);
    
    // Clear form & draft on success
    setTitle('');
    setDescription('');
    setReportType('');
    await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    
    setSnackbarMessage('הדיווח נשלח בהצלחה ונרשם במערכת!');
    setSnackbarVisible(true);
    
    // Go back after delay
    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      }
    }, 1800);
  };

  const handleClearDraft = async () => {
    setTitle('');
    setDescription('');
    setReportType('');
    await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    setSnackbarMessage('טיוטת הדיווח נמחקה');
    setSnackbarVisible(true);
  };

  if (isInitializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#15803D" />
        <Text style={styles.loadingText}>טוען טופס דיווח...</Text>
      </View>
    );
  }

  const hasDraftContent = title.trim() || description.trim() || reportType.trim();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <OfflineBanner />

      {/* 1. Tactical Command Header */}
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <View style={styles.unitBadge}>
            <MaterialIcons name="shield" size={14} color="#15803D" />
            <Text style={styles.unitBadgeText}>ערוץ דיווח גדודי</Text>
          </View>
          <Text style={styles.title}>הגשת דיווח חדש</Text>
        </View>

        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Feather name="arrow-right" size={18} color="#0F172A" />
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.scrollBody} 
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Status / Auto-save Indicator */}
          <View style={styles.draftStatusRow}>
            <View style={styles.autoSavePill}>
              <View style={styles.liveDot} />
              <Text style={styles.autoSaveText}>טיוטה נשמרת אוטומטית במכשיר</Text>
            </View>

            {hasDraftContent && (
              <TouchableOpacity 
                style={styles.clearDraftBtn}
                onPress={handleClearDraft}
                activeOpacity={0.7}
              >
                <Feather name="trash" size={12} color="#DC2626" />
                <Text style={styles.clearDraftText}>נקה טיוטה</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Report Type */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.requiredStar}>*</Text>
                <Text style={styles.label}>סוג הדיווח</Text>
              </View>
              <SearchableDropdown
                data={REPORT_TYPES}
                value={reportType}
                onSelect={setReportType}
                placeholder="בחר סוג דיווח מבצעי..."
              />
            </View>

            {/* Title */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.requiredStar}>*</Text>
                <Text style={styles.label}>נושא / כותרת הדיווח</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="לדוגמה: תקלת קליטה ברכס מזרחי"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
                textAlign="right"
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.requiredStar}>*</Text>
                <Text style={styles.label}>פירוט מלא של האירוע או הבקשה</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="פרט מיקום, מכשירים מעורבים, תסמינים, ופעולות שבוצעו עד כה..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, (!isValid || isLoading) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitButtonText}>משדר דיווח למערכת...</Text>
                </View>
              ) : (
                <View style={styles.submitContent}>
                  <Feather name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>שדר דיווח למפקדה</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onDismiss={() => setSnackbarVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
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
  unitBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 4,
    gap: 4,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  backButton: {
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
  backButtonText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  draftStatusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  autoSavePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  autoSaveText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  clearDraftBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  clearDraftText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
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
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 130,
    lineHeight: 22,
  },
  submitButton: {
    backgroundColor: '#15803D',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
