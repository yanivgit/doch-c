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
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import Snackbar from '../../components/Snackbar';
import SearchableDropdown from '../../components/SearchableDropdown';

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
      setSnackbarMessage('אנא מלא את כל שדות החובה');
      setSnackbarVisible(true);
      return;
    }

    setIsLoading(true);
    
    // Simulate network request or firebase submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    
    // Clear form & draft on success
    setTitle('');
    setDescription('');
    setReportType('');
    await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    
    setSnackbarMessage('הדיווח נשלח בהצלחה!');
    setSnackbarVisible(true);
    
    // Optional: go back after delay
    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      }
    }, 2000);
  };

  if (isInitializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-right" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>הגשת דיווח חדש</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.instruction}>טיוטה נשמרת אוטומטית למכשיר.</Text>
          
          {/* Report Type */}
          <Text style={styles.label}>סוג הדיווח (חובה)</Text>
          <SearchableDropdown
            data={REPORT_TYPES}
            value={reportType}
            onSelect={setReportType}
            placeholder="בחר סוג דיווח..."
          />

          {/* Title */}
          <Text style={styles.label}>כותרת (חובה)</Text>
          <TextInput
            style={styles.input}
            placeholder="נושא הדיווח"
            placeholderTextColor={theme.colors.textMuted}
            value={title}
            onChangeText={setTitle}
            textAlign="right"
          />

          {/* Description */}
          <Text style={styles.label}>פירוט (חובה)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="הזן כאן את פרטי הדיווח..."
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlign="right"
            textAlignVertical="top"
          />

          <TouchableOpacity 
            style={[styles.submitButton, (!isValid || isLoading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>שלח דיווח</Text>
            )}
          </TouchableOpacity>
          
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
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  formContainer: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  instruction: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    fontSize: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  textArea: {
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: 40,
    ...(theme.elevation?.sm as object || {}),
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
