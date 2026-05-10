import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const s = StyleSheet.create({
  container: { marginTop: 24, marginBottom: 20 },
  row: { flexDirection: 'row', marginBottom: 5, alignItems: 'baseline' },
  label: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    fontSize: SIZES.metaLabel,
    color: COLORS.ink,
    width: 110,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: SIZES.meta,
    color: COLORS.ink,
  },
});

export default function MetaBlock({ rep, organization, team, season }) {
  const items = [
    { label: 'Representative', value: rep },
    { label: 'Organization', value: organization },
    { label: 'Group', value: team },
    { label: 'Season', value: season },
  ];
  return (
    <View style={s.container}>
      {items.map(({ label, value }) => (
        <View key={label} style={s.row}>
          <Text style={s.label}>{label}</Text>
          <Text style={s.value}>{value || '\u2014'}</Text>
        </View>
      ))}
    </View>
  );
}
