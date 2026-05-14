import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import { FONTS, PAGE } from '../styles.js';
import ReportHeader from '../components/ReportHeader.jsx';
import MetaBlock from '../components/MetaBlock.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import LineItemRow, { LineItemHeader, SubtotalRow } from '../components/LineItemRow.jsx';
import AdjustmentRow from '../components/AdjustmentRow.jsx';
import FinalAmountBox from '../components/FinalAmountBox.jsx';
import Footer from '../components/Footer.jsx';

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
});

export default function RepCommissionReport({ data }) {
  const hasSecondary = data.has_secondary;
  const hasTpDonations = data.has_tp_donations && data.product_primary_string !== 'MD Donations - Digital';

  const lineItems = [
    data.pp_gross != null && {
      label: data.product_primary_string || 'Primary Product',
      gross: data.pp_gross,
      percent: data.pp_actual_comm_rate,
      amount: data.pp_rep_comm,
    },
    hasSecondary && {
      label: data.product_secondary_name || 'Secondary Product',
      gross: data.sp_gross,
      percent: data.sp_gross ? (data.sp_rep_comm / data.sp_gross) : null,
      amount: data.sp_rep_comm,
    },
    hasTpDonations && {
      label: 'MD Donations - Digital',
      gross: data.mddonations_gross,
      percent: data.mddonations_actual_comm_rate,
      amount: data.mddonations_rep_comm,
    },
  ].filter(Boolean);

  const subtotal = lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const asbLabel = data.asb_boosters === 'WA State ASB'
    ? 'WA State ASB Fee'
    : 'ASB Fee (charged to rep by default)';

  const cdBoxesLabel = data.extra_cd_boxes_ordered
    ? `Extra cookie dough boxes ordered at cost (${data.extra_cd_boxes_ordered} \u00d7 $7)`
    : 'Extra cookie dough boxes';

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <ReportHeader title="REP COMMISSION REPORT" />
        <View style={s.content}>
          <MetaBlock
            rep={data.rep_name}
            organization={data.organization}
            team={data.team}
            season={data.season}
          />

          <SectionHeader>PROFIT SUMMARY</SectionHeader>
          <LineItemHeader columns={{ percent: '% Comm' }} />
          {lineItems.map((item, i) => (
            <LineItemRow
              key={i}
              label={item.label}
              gross={item.gross}
              percent={item.percent}
              amount={item.amount}
            />
          ))}
          <SubtotalRow amount={subtotal} />

          <AdjustmentRow label="Adjustment between team & rep" amount={data.rcr_adj_team_to_rep} />
          <AdjustmentRow label={asbLabel} amount={data.rcr_adj_asbfee} />
          <AdjustmentRow label="50% MD prize shop (if elected by rep)" amount={data.rcr_adj_half_md_prize_fee} />
          <AdjustmentRow label="Small fundraiser adj" amount={data.rcr_adj_smallfradj} />
          <AdjustmentRow label="Excess printing adj" amount={data.rcr_adj_excessprint} />
          <AdjustmentRow label={cdBoxesLabel} amount={data.rcr_adj_extra_cd_boxes} />
          <AdjustmentRow label="Deduction misc" amount={data.rcr_adj_misc} comment={data.rcr_comment} />

          <FinalAmountBox label="FINAL PAYOUT" amount={data.rep_commission} />

          <Footer />
        </View>
      </Page>
    </Document>
  );
}
