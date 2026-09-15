import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme/theme';

interface SnackbarProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onDismiss: () => void;
  duration?: number;
}

export default function Snackbar({ visible, message, actionLabel = 'הבנתי', onDismiss, duration = 3000 }: SnackbarProps) {
  const translateY = useRef(new Animated.Value(100)).current;

  const handleDismiss = React.useCallback(() => {
    Animated.timing(translateY, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [translateY, onDismiss]);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, translateY, handleDismiss]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.actionButton}>
        <Text style={styles.actionLabel}>{actionLabel}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#323232',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    zIndex: 9999,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  actionButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLabel: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
