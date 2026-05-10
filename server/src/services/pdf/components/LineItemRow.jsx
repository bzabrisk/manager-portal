import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, SIZES } from '../styles.js';

const fmt = (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '\u2014';
const pct = (v) => v != null ? `${Math.round(Number(v) * 100)}%` : '\u2014';

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 5,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  label: { flex: 2, fontFamily: FONTS.body, fontWeight: 400, fontSize: SIZES.body, color: COLORS.ink },
  qty: { width: 45, textAlign: 'right', fontFamily: FONTS.body, fontWeight: 400, fontSize: SIZES.body, color: COLORS.ink },
  gross: { width: 75, textAlign: 'right', fontFamily: FONTS.body, fontWeight: 400, fontSize: SIZES.body, color: COLORS.ink },
  percent: { width: 60, textAlign: 'right', fontFamily: FONTS.body, fontWeight: 400, fontSize: SIZES.body, color: COLORS.ink },
  amount: { width: 80, textAlign: 'right', fontFamily: FONTS.body, fontWeight: 400, fontSize: SIZES.body, color: COLORS.ink },
  headerText: { fontFamily: FONTS.body, fontWeight: 700, fontSize: SIZES.small, textTransform: 'uppercase', letterSpacing: 0.5, color: COLORS.inkSoft },
});

export function LineItemHeader({ showQty, columns }) {
  return (
    <View style={s.headerRow}>
      <Text style={[s.label, s.headerText]}>{columns?.label || 'Product'}</Text>
      {showQty && <Text style={[s.qty, s.headerText]}>Qty</Text>}
      <Text style={[s.gross, s.headerText]}>Gross</Text>
      <Text style={[s.percent, s.headerText]}>{columns?.percent || '% to Team'}</Text>
      <Text style={[s.amount, s.headerText]}>Amount</Text>
    </View>
  );
}

export default function LineItemRow({ label, qty, gross, percent, amount, showQty }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      {showQty && <Text style={s.qty}>{qty != null ? String(qty) : '\u2014'}</Text>}
      <Text style={s.gross}>{fmt(gross)}</Text>
      <Text style={s.percent}>{pct(percent)}</Text>
      <Text style={s.amount}>{fmt(amount)}</Text>
    </View>
  );
}

export function SubtotalRow({ amount, showQty }) {
  return (
    <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: COLORS.ink }]}>
      <Text style={[s.label, { fontWeight: 700 }]}>Subtotal</Text>
      {showQty && <Text style={s.qty} />}
      <Text style={s.gross} />
      <Text style={s.percent} />
      <Text style={[s.amount, { fontWeight: 700 }]}>{fmt(amount)}</Text>
    </View>
  );
}

export function InvoiceHeader({ showQty }) {
  return (
    <View style={s.headerRow}>
      <Text style={[s.label, s.headerText]}>Product</Text>
      {showQty && <Text style={[s.qty, s.headerText]}>Qty Sold</Text>}
      <Text style={[s.gross, s.headerText]}>Gross</Text>
      <Text style={[s.percent, s.headerText]}>Rate</Text>
      <Text style={[s.amount, s.headerText]}>Amount</Text>
    </View>
  );
}
