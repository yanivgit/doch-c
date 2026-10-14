import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { theme } from '../theme/theme';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import OfflineBanner from '../components/OfflineBanner';

interface Cycle {
  id: string;
  name: string;
  createdAt?: number;
}

export default function CycleSelectionScreen() {
  const router = useRouter();
  const { selectDoh, userRole, logout } = useApp();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
  };

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await withTimeout(getDocs(collection(db, 'doh_tzade')), 8000);
      const fetchedCycles: Cycle[] = [];
      snapshot.forEach(docSnap => {
        fetchedCycles.push({
          id: docSnap.id,
          name: docSnap.data().name,
          createdAt: docSnap.data().createdAt?.toMillis() || 0,
        });
      });
      fetchedCycles.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCycles(fetchedCycles);
    } catch (error: any) {
      console.error('Error fetching cycles:', error);
      Alert.alert(
        'שגיאה בטעינה',
        `לא ניתן לטעון את הרשימה.\n\nשגיאה: ${error?.message || error}\n\nוודא ש-Firestore מופעל בפרויקט Firebase שלך ושהחוקים מאפשרים גישה.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const handleCreateNew = async () => {
    if (!newCycleName.trim()) return;
    
    // Check for duplicates
    const isDuplicate = cycles.some(c => c.name.toLowerCase() === newCycleName.trim().toLowerCase());
    if (isDuplicate) {
      Alert.alert('שגיאה', 'קיים כבר מסדר בשם זה. אנא בחר שם אחר למסדר.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = await withTimeout(
        addDoc(collection(db, 'doh_tzade'), {
          name: newCycleName.trim(),
          createdAt: serverTimestamp(),
        }),
        8000
      );

      await selectDoh(docRef.id, newCycleName.trim());
      router.replace('/report/kashrag/setup');
    } catch (error: any) {
      console.error('Error creating report:', error);
      Alert.alert(
        'שגיאה ביצירת הדו"ח',
        `הפעולה נכשלה.\n\nשגיאה: ${error?.message || error}\n\nבדוק:\n1. חיבור לאינטרנט\n2. Firestore מופעל בפרויקט\n3. חוקי Firestore מאפשרים כתיבה`
      );
      setIsSubmitting(false);
    }
  };

  const handleSelectCycle = async (id: string, name: string) => {
    try {
      await selectDoh(id, name);
      const rolePath = userRole ? userRole.toLowerCase() : '';
      router.replace(`/report/${rolePath}` as any);
    } catch (error) {
      console.error('Error selecting report:', error);
      Alert.alert('שגיאה', 'בחירת הדו"ח נכשלה. נסה שוב.');
    }
  };

  const handleDeleteCycle = async (id: string, name: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`האם אתה בטוח שברצונך למחוק את הדו"ח "${name}"?`);
      if (confirmed) {
        try {
          setLoading(true);
          await deleteDoc(doc(db, 'doh_tzade', id));
          await fetchCycles();
        } catch (error: any) {
          console.error('Error deleting cycle:', error);
          window.alert('מחיקת הדו"ח נכשלה: ' + (error?.message || error));
          setLoading(false);
        }
      }
      return;
    }

    Alert.alert(
      'מחיקת דו"ח',
      `האם אתה בטוח שברצונך למחוק את הדו"ח "${name}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'מחק לצמיתות', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, 'doh_tzade', id));
              await fetchCycles();
            } catch (error: any) {
              console.error('Error deleting cycle:', error);
              Alert.alert('שגיאה', 'מחיקת הדו"ח נכשלה: ' + (error?.message || error));
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatCycleDate = (timestamp?: number) => {
    if (!timestamp) return 'תאריך לא זמין';
    const date = new Date(timestamp);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderKashragCreateSection = () => (
    <View style={styles.createCard}>
      {!isCreating ? (
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => setIsCreating(true)}
          activeOpacity={0.85}
        >
          <View style={styles.createButtonIcon}>
            <Feather name="plus" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.createButtonTexts}>
            <Text style={styles.createButtonText}>+ יצירת דו"ח צ חדש</Text>
            <Text style={styles.createButtonSubtext}>הקמת מחזור בדיקה חדש והזנת נתוני ציוד</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.creationForm}>
          <View style={styles.creationFormHeader}>
            <MaterialIcons name="playlist-add" size={20} color="#15803D" />
            <Text style={styles.creationFormTitle}>הגדרת מחזור דו"ח צ' חדש</Text>
          </View>

          <Text style={styles.inputLabel}>שם המסדר / מחזור בדיקה</Text>
          <TextInput
            style={styles.input}
            placeholder='הזן שם למחזור / דו"ח...'
            placeholderTextColor="#94A3B8"
            value={newCycleName}
            onChangeText={setNewCycleName}
            autoFocus
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.saveButton, !newCycleName.trim() && styles.disabledButton]}
              onPress={handleCreateNew}
              disabled={!newCycleName.trim() || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  <Text style={styles.saveButtonText}>שמור והיכנס</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => {
                setIsCreating(false);
                setNewCycleName('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={styles.loadingText}>טוען מסדרים מהמערכת...</Text>
        </View>
      );
    }

    if (cycles.length === 0) {
      if (userRole === 'Kashpal') {
        return (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="inbox" size={36} color="#64748B" />
            </View>
            <Text style={styles.emptyTitle}>אין דוחות צ' פעילים כעת</Text>
            <Text style={styles.emptySubtitle}>יש לפנות לקשר"ג הגדודי לצורך פתיחת מחזור מסדר חדש</Text>
          </View>
        );
      }
      return (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Feather name="clipboard" size={36} color="#15803D" />
          </View>
          <Text style={styles.emptyTitle}>טרם הוקמו מסדרים במערכת</Text>
          <Text style={styles.emptySubtitle}>לחץ על "יצירת דו"ח צ חדש" למעלה כדי להתחיל בספירת הציוד</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={cycles}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View style={styles.cycleCard}>
            <TouchableOpacity
              style={styles.cycleCardMain}
              onPress={() => handleSelectCycle(item.id, item.name)}
              activeOpacity={0.8}
            >
              <View style={styles.cycleHeaderRow}>
                <View style={styles.cycleBadge}>
                  <Text style={styles.cycleBadgeText}>מסדר #{cycles.length - index}</Text>
                </View>
                {item.createdAt ? (
                  <View style={styles.cycleDateBadge}>
                    <Feather name="calendar" size={12} color="#64748B" />
                    <Text style={styles.cycleDateText}>{formatCycleDate(item.createdAt)}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.cycleTitle}>{item.name}</Text>

              <View style={styles.cycleFooterRow}>
                <View style={styles.enterButtonPill}>
                  <Text style={styles.enterButtonText}>כניסה למסדר</Text>
                  <Feather name="chevron-left" size={16} color="#15803D" />
                </View>
                <Text style={styles.cycleSubmeta}>לחץ לפתיחת הדו"ח</Text>
              </View>
            </TouchableOpacity>

            {userRole === 'Kashrag' && (
              <TouchableOpacity 
                style={styles.deleteCycleButton}
                onPress={() => handleDeleteCycle(item.id, item.name)}
                activeOpacity={0.7}
                accessibilityLabel={`מחק מסדר ${item.name}`}
              >
                <Feather name="trash-2" size={18} color="#DC2626" />
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <OfflineBanner />

      {/* Tactical Top Command Header */}
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <View style={styles.unitBadge}>
            <MaterialIcons name="shield" size={14} color="#15803D" />
            <Text style={styles.unitBadgeText}>פורטל מסדרים גדודי</Text>
          </View>
          <Text style={styles.title}>בחירת דו"ח צ׳ פעיל</Text>
        </View>

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={logout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color="#DC2626" />
          <Text style={styles.backButtonText}>יציאה</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Kashrag create section */}
        {userRole === 'Kashrag' && renderKashragCreateSection()}

        {!loading && cycles.length > 0 && (
          <View style={styles.listSectionHeader}>
            <View style={styles.listSectionCount}>
              <Text style={styles.listSectionCountText}>{cycles.length}</Text>
            </View>
            <Text style={styles.listSectionTitle}>מסדרים זמינים במערכת:</Text>
          </View>
        )}

        {renderContent()}
      </View>
    </SafeAreaView>
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
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  backButtonText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  createCard: {
    marginBottom: 16,
  },
  createButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#15803D',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    gap: 12,
  },
  createButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonTexts: {
    flex: 1,
    alignItems: 'flex-end',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  createButtonSubtext: {
    color: '#DCFCE7',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  creationForm: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#15803D',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  creationFormHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  creationFormTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'right',
    marginBottom: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  saveButton: {
    backgroundColor: '#15803D',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  listSectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
    gap: 8,
  },
  listSectionCount: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  listSectionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
  },
  cycleCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  cycleCardMain: {
    flex: 1,
    padding: 16,
  },
  cycleHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cycleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cycleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  cycleDateBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  cycleDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cycleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 10,
  },
  cycleFooterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enterButtonPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  enterButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  cycleSubmeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  deleteCycleButton: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRightWidth: 1,
    borderRightColor: '#FFE4E6',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
