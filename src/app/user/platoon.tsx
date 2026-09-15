import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDevicesByPlatoon, Device, logEvent } from '../../firebase/api';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function UserPlatoonScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchDevices = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'devices'), where('assignment', '==', name));
      const snap = await getDocs(q);
      const data: Device[] = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Device));
      setDevices(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    fetchDevices();
  }, [name, fetchDevices]);

  const handleInventoryCheck = async () => {
    if (devices.length === 0) return;

    setChecking(true);
    try {
      // Update all devices lastChecked timestamp
      const updatePromises = devices.map(device => {
        if (device.id) {
          const deviceRef = doc(db, 'devices', device.id);
          return updateDoc(deviceRef, {
            lastChecked: Timestamp.now()
          });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);

      // Log the event
      await logEvent({
        tsadiNumber: 'multiple',
        action: 'CHECKED',
        user: name,
        details: `פלוגה ${name} ביצעה דו"ח צ (נוכחות כללית)`,
      });

      Alert.alert('עודכן', 'דו"ח צ עודכן בהצלחה לכל הציוד', [
        { text: 'אישור', onPress: fetchDevices }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('שגיאה', 'שגיאה בעדכון דו"ח צ');
    } finally {
      setChecking(false);
    }
  };

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
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutButton} onPress={() => router.replace('/')}>
          <Text style={styles.logoutText}>התנתק</Text>
        </TouchableOpacity>
        <Text style={styles.title}>שלום, {name}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.checkButton, checking && styles.checkButtonDisabled]}
        onPress={handleInventoryCheck}
        disabled={checking || devices.length === 0}
      >
        {checking ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.checkButtonText}>אשר נוכחות כל הציוד</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.subtitle}>הציוד שלך:</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#208AEF" />
      ) : devices.length === 0 ? (
        <Text style={styles.emptyText}>לא משויך ציוד לפלוגה זו</Text>
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
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    backgroundColor: '#eee',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'right',
    marginBottom: 10,
  },
  checkButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  checkButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  checkButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
