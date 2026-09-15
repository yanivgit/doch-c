import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getAllPlatoons } from '../../firebase/api';

export default function PlatoonsScreen() {
  const router = useRouter();
  const [platoons, setPlatoons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlatoons = async () => {
    try {
      const data = await getAllPlatoons();
      setPlatoons(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatoons();
  }, []);

  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/admin/platoon/${item}` as any)}
    >
      <Text style={styles.cardTitle}>{item}</Text>
      <Text style={styles.cardSubtitle}>הקש לצפייה בציוד</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>תצוגת פלוגות</Text>
        <View style={{ width: 60 }} />
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#208AEF" />
      ) : platoons.length === 0 ? (
        <Text style={styles.emptyText}>לא נמצאו פלוגות במערכת</Text>
      ) : (
        <FlatList
          data={platoons}
          keyExtractor={(item) => item}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
  },
  backButton: {
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#208AEF',
    textAlign: 'right',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 40,
  }
});
