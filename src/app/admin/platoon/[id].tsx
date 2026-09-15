import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getDevicesByPlatoon, Device } from '../../../firebase/api';

export default function PlatoonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getDevicesByPlatoon(id);
      setDevices(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchDevices();
    }
  }, [id, fetchDevices]);

  const renderItem = ({ item }: { item: Device }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.type}</Text>
      <Text style={styles.cardText}>צ&apos;: {item.tsadiNumber}</Text>
      <Text style={styles.cardText}>
        בדיקה אחרונה: {item.lastChecked ? item.lastChecked.toDate().toLocaleString('he-IL') : 'לא נבדק'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ציוד - {id}</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#208AEF" />
      ) : devices.length === 0 ? (
        <Text style={styles.emptyText}>לא נמצא ציוד לפלוגה זו</Text>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id || item.tsadiNumber}
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
    marginBottom: 20,
    color: '#333',
    textAlign: 'right',
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 40,
  }
});
