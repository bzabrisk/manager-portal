import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const fmt = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingLeft: 10,
  },
  label: {
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
    textAlign: 'right',
  },
  comment: {
    fontFamily: FONTS.alt,
    fontWeight: 700,
    fontStyle: 'italic',
    fontSize: SIZES.small,
    color: COLORS.inkMuted,
    paddingLeft: 10,
    marginTop: 1,
  },
});

export default function AdjustmentRow({ label, amount, comment }) {
  if (amount == null || amount === 0 || amount === '') return null;
  return (
    <View>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.amount}>{fmt(amount)}</Text>
      </View>
      {comment ? <Text style={s.comment}>{comment}</Text> : null}
    </View>
  );
}
