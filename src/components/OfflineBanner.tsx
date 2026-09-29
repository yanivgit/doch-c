import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface OfflineBannerProps {
  /** Optional custom test state override */
  forceOffline?: boolean;
}

export default function OfflineBanner({ forceOffline }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(() => {
    if (forceOffline !== undefined) return forceOffline;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return !navigator.onLine;
    }
    return false;
  });

  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  // Pulse animation for warning dot (useState initializer avoids ref access during render)
  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Fade & slide animation for banner appearance
  const [slideAnim] = useState(() => new Animated.Value(0));

  const handleConnectionChange = useCallback((offline: boolean) => {
    if (offline) {
      wasOfflineRef.current = true;
      setIsOffline(true);
      setShowReconnected(false);
    } else {
      setIsOffline(false);
      // If we were previously offline and just came back online, show reconnected banner briefly
      if (wasOfflineRef.current) {
        setShowReconnected(true);
        wasOfflineRef.current = false;
        setTimeout(() => {
          setShowReconnected(false);
        }, 3200);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Listen via @react-native-community/netinfo
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      handleConnectionChange(offline);
    });

    // 2. Additional browser listener for 100% web/PWA reliability
    let handleWebOnline: (() => void) | null = null;
    let handleWebOffline: (() => void) | null = null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      handleWebOnline = () => handleConnectionChange(false);
      handleWebOffline = () => handleConnectionChange(true);

      window.addEventListener('online', handleWebOnline);
      window.addEventListener('offline', handleWebOffline);
    }

    return () => {
      unsubscribeNetInfo();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (handleWebOnline) window.removeEventListener('online', handleWebOnline);
        if (handleWebOffline) window.removeEventListener('offline', handleWebOffline);
      }
    };
  }, [handleConnectionChange]);

  // Pulse animation loop when offline
  useEffect(() => {
    if (isOffline) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOffline, pulseAnim]);

  // Slide/fade animation when banner visibility changes
  const isVisible = isOffline || showReconnected;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  if (!isVisible) {
    return null;
  }

  // Render reconnected banner
  if (showReconnected && !isOffline) {
    return (
      <Animated.View
        style={[
          styles.bannerBase,
          styles.reconnectedBanner,
          {
            opacity: slideAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.contentRow}>
          <Feather name="check-circle" size={15} color="#15803D" style={styles.icon} />
          <Text style={styles.reconnectedTitle}>החיבור חודש!</Text>
          <Text style={styles.reconnectedSubtitle}>הנתונים מסונכרנים כעת לענן</Text>
        </View>
      </Animated.View>
    );
  }

  // Render tactical offline banner
  return (
    <Animated.View
      style={[
        styles.bannerBase,
        styles.offlineBanner,
        {
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.badgeWrapper}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
          <MaterialCommunityIcons name="cloud-off-outline" size={16} color="#B45309" />
          <Text style={styles.offlineBadgeText}>אין קליטה (Offline)</Text>
        </View>
        <View style={styles.textDivider} />
        <Text style={styles.offlineReassuranceText} numberOfLines={1}>
          שמירה מקומית פעילה • הנתונים יסונכרנו בעת חיבור
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerBase: {
    width: '100%',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7', // Tactical amber-100
    borderBottomColor: '#F59E0B', // Amber-500
  },
  reconnectedBanner: {
    backgroundColor: '#DCFCE7', // Tactical emerald-100
    borderBottomColor: '#10B981', // Emerald-500
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A', // Amber-200
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    gap: 5,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D97706', // Amber-600
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E', // Amber-800
  },
  textDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#D97706',
    opacity: 0.4,
  },
  offlineReassuranceText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#78350F', // Amber-900
    textAlign: 'center',
  },
  icon: {
    marginRight: 2,
  },
  reconnectedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534', // Emerald-800
  },
  reconnectedSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#15803D', // Emerald-700
  },
});
