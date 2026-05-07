import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const s = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 8 },
  text: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    fontSize: SIZES.sectionHeader,
    color: COLORS.orange,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  line: {
    height: 1,
    backgroundColor: COLORS.orange,
    marginTop: 4,
  },
});

export default function SectionHeader({ children }) {
  return (
    <View style={s.container}>
      <Text style={s.text}>{children}</Text>
      <View style={s.line} />
    </View>
  );
}
