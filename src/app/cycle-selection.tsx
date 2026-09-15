import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { theme } from '../theme/theme';

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
      snapshot.forEach(doc => {
        fetchedCycles.push({
          id: doc.id,
          name: doc.data().name,
          createdAt: doc.data().createdAt?.toMillis() || 0,
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
    setIsSubmitting(true);
    try {
      // 1. Create Firebase document (with 8s timeout)
      const docRef = await withTimeout(
        addDoc(collection(db, 'doh_tzade'), {
          name: newCycleName.trim(),
          createdAt: serverTimestamp(),
        }),
        8000
      );

      // 2. Deferred persistence — saves BOTH userRole + dohId/name to AsyncStorage
      await selectDoh(docRef.id, newCycleName.trim());

      // 3. Navigate to rapid setup explicitly for Kashrag
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
      // Deferred persistence — saves BOTH userRole + dohId/name to AsyncStorage
      await selectDoh(id, name);
      
      // Navigate explicitly
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
          text: 'מחק', 
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

  // The Kashrag creation form / button block — always visible for Kashrag
  const renderKashragCreateSection = () => (
    <View style={styles.createContainer}>
      {!isCreating ? (
        <TouchableOpacity style={styles.createButton} onPress={() => setIsCreating(true)}>
          <Text style={styles.createButtonText}>+ יצירת דו&quot;ח צ חדש</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.creationForm}>
          <TextInput
            style={styles.input}
            placeholder='הזן שם למחזור / דו"ח...'
            value={newCycleName}
            onChangeText={setNewCycleName}
            autoFocus
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.saveButton, !newCycleName.trim() && styles.disabledButton]}
              onPress={handleCreateNew}
              disabled={!newCycleName.trim() || isSubmitting}
            >
              <Text style={styles.saveButtonText}>{isSubmitting ? 'שומר...' : 'שמור והיכנס'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsCreating(false)}>
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />;
    }

    if (cycles.length === 0) {
      // Empty state — different per role
      if (userRole === 'Kashpal') {
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>אין דוחות צ&apos; פעילים</Text>
            <Text style={styles.emptySubtitle}>פנה לקשר&quot;ג ליצירת דו&quot;ח חדש</Text>
          </View>
        );
      }
      // Kashrag empty state — show message AND create button (already shown above)
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>אין דוחות קיימים במערכת</Text>
          <Text style={styles.emptySubtitle}>לחץ על &quot;יצירת דו&quot;ח חדש&quot; להתחלה</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={cycles}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.cycleItemContainer}>
            <TouchableOpacity
              style={styles.cycleItem}
              onPress={() => handleSelectCycle(item.id, item.name)}
            >
              <Text style={styles.cycleText}>{item.name}</Text>
            </TouchableOpacity>
            {userRole === 'Kashrag' && (
              <TouchableOpacity 
                style={styles.deleteCycleButton}
                onPress={() => handleDeleteCycle(item.id, item.name)}
              >
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={logout}>
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>בחירת דו&quot;ח צ</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Kashrag create section is always visible for that role */}
      {userRole === 'Kashrag' && renderKashragCreateSection()}

      {!loading && cycles.length > 0 && (
        <Text style={styles.subtitle}>בחר דו&quot;ח קיים:</Text>
      )}

      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
  },
  backButton: {
    padding: 10,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  createContainer: {
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  creationForm: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: theme.colors.success,
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    flex: 1,
    alignItems: 'center',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: theme.colors.surfaceLight,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: theme.colors.danger,
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textMuted,
    marginBottom: 15,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  cycleItemContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  cycleItem: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  deleteCycleButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // Light tint of danger
    padding: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleText: {
    fontSize: 16,
    textAlign: 'right',
    color: theme.colors.text,
  },
});
