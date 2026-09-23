import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { addDevice, logEvent } from '../../firebase/api';

export default function AddDeviceScreen() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [tsadiNumber, setTsadiNumber] = useState('');
  const [assignment, setAssignment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddDevice = async () => {
    if (!type || !tsadiNumber || !assignment) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    setLoading(true);
    try {
      await addDevice({
        type,
        tsadiNumber,
        assignment,
      });

      await logEvent({
        tsadiNumber,
        action: 'CREATE',
        user: 'admin',
        details: `נוסף מכשיר ${type} ושויך ל-${assignment}`,
      });

      Alert.alert('הצלחה', 'הציוד נוסף בהצלחה');
      router.back();
    } catch (error: any) {
      if (error.message === 'DUPLICATE_TSADI') {
        Alert.alert('שגיאה', 'מספר צ\' זה כבר קיים בפלוגה זו.');
      } else {
        Alert.alert('שגיאה', 'לא ניתן להוסיף ציוד. נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הוספת ציוד צ&apos; חדש</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>סוג מכשיר</Text>
        <TextInput
          style={styles.input}
          placeholder="לדוגמה: נייד 710"
          value={type}
          onChangeText={setType}
        />

        <Text style={styles.label}>מספר צ&apos; (צדי)</Text>
        <TextInput
          style={styles.input}
          placeholder="לדוגמה: צ-123456"
          value={tsadiNumber}
          onChangeText={setTsadiNumber}
        />

        <Text style={styles.label}>שיוך / פלוגה</Text>
        <TextInput
          style={styles.input}
          placeholder="לדוגמה: פלוגה א'"
          value={assignment}
          onChangeText={setAssignment}
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAddDevice}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>הוסף מכשיר</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
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
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'right',
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#208AEF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
