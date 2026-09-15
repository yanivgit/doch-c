import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { theme } from '../theme/theme';

interface SearchableDropdownProps {
  data: string[];
  value: string;
  onSelect: (val: string) => void;
  placeholder: string;
  allowFreeText?: boolean;
  onDropdownToggle?: (isOpen: boolean) => void;
}

export default function SearchableDropdown({ 
  data, 
  value, 
  onSelect, 
  placeholder, 
  allowFreeText = false,
  onDropdownToggle // kept for backwards compatibility but functionally obsolete
}: SearchableDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleOpen = () => {
    setQuery(value); // Reset query to current value when opening
    setModalVisible(true);
    onDropdownToggle?.(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    onDropdownToggle?.(false);
  };

  const handleSelect = useCallback((item: string) => {
    onSelect(item);
    handleClose();
  }, [onSelect]);

  const filteredData = data.filter(item => item.includes(query));

  return (
    <>
      <TouchableOpacity 
        style={styles.triggerInput} 
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{placeholder}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="הקלד לחיפוש..."
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (allowFreeText) {
                    handleSelect(query);
                  }
                }}
              />
            </View>

            <FlatList
              data={allowFreeText && query && !data.includes(query) ? [query, ...filteredData] : filteredData}
              keyExtractor={(item, index) => `${item}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[
                    styles.dropdownText, 
                    allowFreeText && index === 0 && query && !data.includes(query) && styles.freeTextLabel
                  ]}>
                    {allowFreeText && index === 0 && query && !data.includes(query) ? `הוסף כטקסט חופשי: "${item}"` : item}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>לא נמצאו תוצאות</Text>
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    marginBottom: 15,
    justifyContent: 'center',
    minHeight: 50,
  },
  triggerText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'right',
  },
  placeholderText: {
    color: theme.colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    fontSize: 16,
    textAlign: 'right',
  },
  listContent: {
    paddingBottom: 20,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  dropdownText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'right',
  },
  freeTextLabel: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 16,
  }
});
