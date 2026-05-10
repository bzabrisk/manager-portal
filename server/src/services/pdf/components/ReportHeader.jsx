import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { COLORS, FONTS, SIZES } from '../styles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoPath = join(__dirname, '..', '..', '..', 'assets', 'images', 'smash-logo-white.png');

const s = StyleSheet.create({
  band: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 40,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 100 },
  title: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    color: COLORS.white,
    fontSize: SIZES.reportTitle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export default function ReportHeader({ title }) {
  return (
    <View style={s.band}>
      <Image src={logoPath} style={s.logo} />
      <Text style={s.title}>{title}</Text>
    </View>
  );
}
