import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getAllLogs, LogEvent } from '../../firebase/api';
import { useRouter } from 'expo-router';

export default function LogsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await getAllLogs();
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: LogEvent }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.actionText}>
          {item.action === 'CREATE' ? 'יצירה' : 
           item.action === 'TRANSFER' ? 'העברה' : 
           item.action === 'CHECKED' ? 'בדיקה' : item.action}
        </Text>
        <Text style={styles.dateText}>
          {item.timestamp ? item.timestamp.toDate().toLocaleString('he-IL') : ''}
        </Text>
      </View>
      <Text style={styles.detailsText}>{item.details}</Text>
      <Text style={styles.userText}>משתמש: {item.user}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>יומן אירועים</Text>
        <View style={{ width: 60 }} />
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#208AEF" />
      ) : logs.length === 0 ? (
        <Text style={styles.emptyText}>אין אירועים להצגה</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={renderItem}
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208AEF',
  },
  dateText: {
    fontSize: 14,
    color: '#888',
  },
  detailsText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    marginBottom: 8,
  },
  userText: {
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
