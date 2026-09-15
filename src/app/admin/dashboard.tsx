import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { getAllDevices, getAllPlatoons } from '../../firebase/api';

export default function AdminDashboard() {
  const router = useRouter();
  const { selectedDohId, selectedDohName } = useApp();
  
  const [stats, setStats] = useState({ devices: 0, platoons: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!selectedDohId) {
        setLoadingStats(false);
        return;
      }
      try {
        const [devicesData, platoonsData] = await Promise.all([
          getAllDevices(selectedDohId),
          getAllPlatoons()
        ]);
        setStats({ devices: devicesData.length, platoons: platoonsData.length });
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [selectedDohId]);

  const menuItems = [
    { id: 'add', title: 'הוסף מכשיר', description: 'הוספת מכשיר קשר חדש למאגר', route: '/admin/add-device' },
    { id: 'platoons', title: 'תצוגת פלוגות', description: 'צפייה וניהול של פלוגות ומחלקות', route: '/admin/platoons' },
    { id: 'check', title: 'ווידוא דו"ח צ', description: 'הפעלת אירוע ספירת מלאי', route: '/admin/inventory-check' },
    { id: 'logs', title: 'יומן אירועים', description: 'היסטוריית העברות ופעולות', route: '/admin/logs' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>שלום, מחלקת קשר</Text>
        <Text style={styles.headerSubtitle}>דו&quot;ח פעיל: {selectedDohName || selectedDohId || 'אין'}</Text>
      </View>

      <View style={styles.statsContainer}>
        {loadingStats ? (
          <ActivityIndicator size="small" color="#208AEF" />
        ) : (
          <>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.devices}</Text>
              <Text style={styles.statLabel}>מכשירים</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.platoons}</Text>
              <Text style={styles.statLabel}>פלוגות</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.grid}>
        {menuItems.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity style={styles.logoutButton} onPress={() => router.replace('/')}>
        <Text style={styles.logoutText}>התנתק</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
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
    marginBottom: 8,
    textAlign: 'right',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  logoutButton: {
    marginTop: 40,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#eee',
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#208AEF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  }
});
