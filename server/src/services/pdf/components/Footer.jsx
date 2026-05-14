import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const s = StyleSheet.create({
  container: { marginTop: 'auto', paddingTop: 20 },
  line: { height: 1, backgroundColor: COLORS.orange, marginBottom: 6 },
  text: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: SIZES.small,
    color: COLORS.inkMuted,
  },
});

export default function Footer() {
  return (
    <View style={s.container}>
      <View style={s.line} />
      <Text style={s.text}>smashfundraising.com</Text>
    </View>
  );
}
