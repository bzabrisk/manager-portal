import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const s = StyleSheet.create({
  container: { marginTop: 20, marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: {
    fontFamily: FONTS.body,
    fontWeight: 900,
    fontSize: SIZES.meta,
    color: COLORS.ink,
    width: 100,
  },
  value: {
    fontFamily: FONTS.body,
    fontSize: SIZES.meta,
    color: COLORS.inkSoft,
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
