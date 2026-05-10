import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const fmt = (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';

const s = StyleSheet.create({
  box: {
    backgroundColor: COLORS.ink,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  label: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    fontSize: SIZES.finalAmount,
    color: COLORS.white,
    letterSpacing: 1,
  },
  amount: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    fontSize: SIZES.finalAmount,
    color: COLORS.white,
  },
});

export default function FinalAmountBox({ label, amount }) {
  return (
    <View style={s.box}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.amount}>{fmt(amount)}</Text>
    </View>
  );
}
