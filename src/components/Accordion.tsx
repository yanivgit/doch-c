import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { theme } from '../theme/theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface AccordionProps {
  title: string;
  summary?: string;
  children: React.ReactNode;
  initiallyExpanded?: boolean;
}

export default function Accordion({ title, summary, children, initiallyExpanded = false }: AccordionProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.7}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Text style={styles.icon}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginVertical: 6,
    marginHorizontal: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRightWidth: 4,
    borderRightColor: theme.colors.primary,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(67, 56, 202, 0.03)', // Very light primary tint
  },
  headerContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  summary: {
    fontSize: 14,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  icon: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  content: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  }
});
