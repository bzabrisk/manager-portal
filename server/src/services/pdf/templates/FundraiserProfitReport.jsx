import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, PAGE } from '../styles.js';
import ReportHeader from '../components/ReportHeader.jsx';
import MetaBlock from '../components/MetaBlock.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import LineItemRow, { LineItemHeader, SubtotalRow, InvoiceHeader } from '../components/LineItemRow.jsx';
import AdjustmentRow from '../components/AdjustmentRow.jsx';
import FinalAmountBox from '../components/FinalAmountBox.jsx';
import Footer from '../components/Footer.jsx';

const fmt = (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '\u2014';

const s = StyleSheet.create({
  page: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 10,
    paddingTop: PAGE.paddingTop,
    paddingBottom: PAGE.paddingBottom,
  },
  content: {
    paddingHorizontal: PAGE.paddingHorizontal,
    flex: 1,
  },
  grossLine: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 10,
    color: COLORS.inkSoft,
    marginBottom: 4,
  },
  footnoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
    paddingLeft: 10,
    paddingVertical: 8,
    marginTop: 12,
    backgroundColor: COLORS.orangeLight,
  },
  footnoteText: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 8,
    color: COLORS.inkSoft,
    lineHeight: 1.5,
  },
  commentsBox: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  commentsText: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 8,
    color: COLORS.inkMuted,
    lineHeight: 1.5,
  },
});

export default function FundraiserProfitReport({ data }) {
  const isTradNoRisk = data.product_primary_string === 'Team Cards - Traditional No-Risk';
  const isTradUpfront = data.product_primary_string === 'Team Cards - Traditional Upfront Purchase';
  const isWaAsb = data.asb_boosters === 'WA State ASB';
  const hasSecondary = data.has_secondary;
  const hasTpDonations = data.has_tp_donations && data.product_primary_string !== 'MD Donations - Digital';
  const showProfitSummary = !isTradUpfront;
  const showInvoiceSection = isWaAsb || isTradNoRisk || isTradUpfront;
  const showQtyColumn = isTradNoRisk || isTradUpfront;
  const showGrossTotalCollected = !isTradUpfront;
  const showTierFootnote = isTradUpfront;

  const lineItems = [
    data.pp_gross && {
      label: data.product_primary_string || 'Primary Product',
      qty: data.cards_sold,
      gross: data.pp_gross,
      percent: data.pp_actual_team_rate,
      amount: data.pp_team_profit,
      invoiceRate: data.pp_gross ? (data.pp_invoice_amount / data.pp_gross) : null,
      invoiceAmount: data.pp_invoice_amount,
    },
    hasSecondary && {
      label: data.product_secondary_name || 'Secondary Product',
      qty: null,
      gross: data.sp_gross,
      percent: data.sp_gross ? (data.sp_team_profit / data.sp_gross) : null,
      amount: data.sp_team_profit,
      invoiceRate: data.sp_gross ? (data.sp_invoice_amount / data.sp_gross) : null,
      invoiceAmount: data.sp_invoice_amount,
    },
    hasTpDonations && {
      label: 'MD Donations - Digital',
      qty: null,
      gross: data.mddonations_gross,
      percent: data.mddonations_gross ? (data.mddonations_team_profit / data.mddonations_gross) : null,
      amount: data.mddonations_team_profit,
      invoiceRate: data.mddonations_gross ? (data.mddonations_invoice_amount / data.mddonations_gross) : null,
      invoiceAmount: data.mddonations_invoice_amount,
    },
  ].filter(Boolean);

  // For Traditional Upfront, the per-unit dollar amount is more meaningful than a percentage
  const upfrontPerCardAmount = isTradUpfront && data.cards_sold
    ? (data.pp_invoice_amount / data.cards_sold)
    : null;

  const profitSubtotal = lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const invoiceSubtotal = lineItems.reduce((sum, i) => sum + (Number(i.invoiceAmount) || 0), 0);

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <ReportHeader title="FUNDRAISER PROFIT REPORT" />
        <View style={s.content}>
          <MetaBlock
            rep={data.rep_name}
            organization={data.organization}
            team={data.team}
            season={data.season}
          />

          {showGrossTotalCollected && (
            <Text style={s.grossLine}>
              Gross Total Collected: {fmt(data.gross_sales_md)}
            </Text>
          )}

          {showProfitSummary && (
            <View>
              <SectionHeader>PROFIT SUMMARY</SectionHeader>
              <LineItemHeader showQty={showQtyColumn} />
              {lineItems.map((item, i) => (
                <LineItemRow
                  key={i}
                  label={item.label}
                  qty={item.qty}
                  gross={item.gross}
                  percent={item.percent}
                  amount={item.amount}
                  showQty={showQtyColumn}
                />
              ))}
              <SubtotalRow amount={profitSubtotal} showQty={showQtyColumn} />

              <AdjustmentRow label="50% Prize Share" amount={data.fpr_adj_md_prize_share} />
              <AdjustmentRow label="Adjustment between team & rep" amount={data.fpr_adj_team_to_rep} />
              <AdjustmentRow label="ASB Fee" amount={data.fpr_adj_asbfee} />
              {isTradNoRisk && (
                <AdjustmentRow label="Discount on lost cards" amount={data.fpr_adj_discount_on_lost_cards} />
              )}

              <FinalAmountBox label="FINAL PROFIT" amount={data.final_team_profit} />
            </View>
          )}

          {showInvoiceSection && (
            <View>
              <SectionHeader>INVOICE</SectionHeader>
              <InvoiceHeader showQty={showQtyColumn} />
              {lineItems.map((item, i) => (
                <LineItemRow
                  key={i}
                  label={item.label}
                  qty={item.qty}
                  gross={item.gross}
                  percent={isTradUpfront && i === 0 ? upfrontPerCardAmount : item.invoiceRate}
                  amount={item.invoiceAmount}
                  showQty={showQtyColumn}
                  rateAsCurrency={isTradUpfront && i === 0}
                />
              ))}
              {/* Invoice adjustments — inverse of profit adjustments */}
              <AdjustmentRow
                label="50% Prize Share"
                amount={data.fpr_adj_md_prize_share != null ? -data.fpr_adj_md_prize_share : null}
              />
              <AdjustmentRow
                label="Adjustment between team & rep"
                amount={data.fpr_adj_team_to_rep != null ? -data.fpr_adj_team_to_rep : null}
              />
              <AdjustmentRow
                label="ASB Fee"
                amount={data.fpr_adj_asbfee != null ? -data.fpr_adj_asbfee : null}
              />
              {isTradNoRisk && (
                <AdjustmentRow
                  label="Discount on lost cards"
                  amount={data.fpr_adj_discount_on_lost_cards != null ? -data.fpr_adj_discount_on_lost_cards : null}
                />
              )}

              <FinalAmountBox label="FINAL INVOICE" amount={data.final_invoice_amount} />
            </View>
          )}

          {showTierFootnote && (
            <View style={s.footnoteBox}>
              <Text style={s.footnoteText}>
                {'Comments: Please send payment in USD only.\n\nTiers are converted to USD for payment using live USD/CAD conversion.\n1000 ct = $8 CAD/card\n1500 ct = $7 CAD/card\n2000+ ct = $6 CAD/card'}
              </Text>
            </View>
          )}

          {data.fpr_comments && (
            <View style={s.commentsBox}>
              <Text style={s.commentsText}>{data.fpr_comments}</Text>
            </View>
          )}

          <Footer />
        </View>
      </Page>
    </Document>
  );
}
