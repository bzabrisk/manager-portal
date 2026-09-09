import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS } from '../styles.js';

const fmt = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingLeft: 10,
  },
  label: {
    flex: 1,
    paddingRight: 12,
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 9,
    color: COLORS.inkMuted,
  },
  amount: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 9,
    color: COLORS.inkSoft,
    width: 80,
    flexShrink: 0,
    textAlign: 'right',
  },
});

export default function AdjustmentRow({ label, amount }) {
  if (amount == null || amount === 0 || amount === '') return null;
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.amount}>{fmt(amount)}</Text>
    </View>
  );
}

// Free-text note printed beneath the adjustment rows. Renders nothing when empty
// so an empty comment never leaves a blank block on the report. Reuses the row and
// label styles above so it is typeset exactly like the adjustment line items.
export function AdjustmentComment({ text }) {
  if (!text) return null;
  return (
    <View style={s.row}>
      <Text style={s.label}>{text}</Text>
    </View>
  );
}
