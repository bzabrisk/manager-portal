import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS, FONTS, PAGE } from '../styles.js';
import ReportHeader from '../components/ReportHeader.jsx';
import Footer from '../components/Footer.jsx';

const TIERED_PRODUCTS = new Set([
  'Team Cards - Traditional Upfront Purchase',
  'Team Cards - Traditional No-Risk',
  'Team Cards - MD Digital',
]);
const isTiered = (name) => TIERED_PRODUCTS.has(name);

const fmtDate = (d) => {
  if (!d) return 'TBD';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
};

const s = StyleSheet.create({
  page: {
    fontFamily: FONTS.body,
    fontSize: 8,
    paddingTop: PAGE.paddingTop,
    paddingBottom: PAGE.paddingBottom,
  },
  content: {
    paddingHorizontal: PAGE.paddingHorizontal,
    flex: 1,
  },
  // Top row
  topRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 16,
  },
  introCol: {
    flex: 1,
  },
  introText: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.ink,
    lineHeight: 1.5,
  },
  detailsBox: {
    width: '35%',
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    borderRadius: 3,
  },
  detailsTitle: {
    fontFamily: FONTS.body,
    fontWeight: 700,
    fontSize: 9,
    color: COLORS.ink,
    marginBottom: 4,
  },
  detailsLine: {
    fontFamily: FONTS.body,
    fontSize: 8,
    color: COLORS.ink,
    marginBottom: 2,
  },
  // Products mini-table
  prodTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 2,
    marginTop: 6,
    marginBottom: 2,
  },
  prodTableRow: {
    flexDirection: 'row',
    paddingVertical: 1.5,
  },
  prodName: { flex: 1, fontFamily: FONTS.body, fontSize: 7, color: COLORS.ink },
  prodPct: { width: 45, textAlign: 'right', fontFamily: FONTS.body, fontSize: 7, color: COLORS.ink },
  prodHeaderText: { fontFamily: FONTS.body, fontWeight: 700, fontSize: 7, color: COLORS.inkSoft },
  // Section headers
  sectionHeader: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  sectionLine: {
    height: 1,
    backgroundColor: COLORS.orange,
    marginBottom: 6,
  },
  // List items
  listItem: {
    fontFamily: FONTS.body,
    fontSize: 8,
    color: COLORS.ink,
    lineHeight: 1.5,
    marginBottom: 3,
    paddingLeft: 4,
  },
  // Checkbox boxes row
  checkboxRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  checkboxBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 2,
    padding: 6,
  },
  checkboxLabel: {
    fontFamily: FONTS.body,
    fontSize: 7,
    color: COLORS.ink,
    lineHeight: 1.4,
  },
  checkMark: {
    fontFamily: FONTS.body,
    fontSize: 9,
    marginRight: 3,
  },
  // Additional notes
  notesLabel: {
    fontFamily: FONTS.body,
    fontWeight: 700,
    fontSize: 8,
    color: COLORS.ink,
    marginTop: 6,
    marginBottom: 2,
  },
  notesText: {
    fontFamily: FONTS.body,
    fontSize: 8,
    color: COLORS.ink,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  // Signature block
  sigBlock: {
    marginTop: 14,
    gap: 10,
  },
  sigRow: {
    flexDirection: 'row',
    gap: 24,
  },
  sigCell: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.ink,
    height: 18,
  },
  sigLineWithContent: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.ink,
    height: 24,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  sigLabel: {
    fontFamily: FONTS.body,
    fontSize: 7,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  sigName: {
    fontFamily: FONTS.signature,
    fontSize: 22,
    color: COLORS.ink,
  },
  sigPrintName: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.ink,
  },
  sigDate: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.ink,
  },
  // SMASH Records section
  recordsHeader: {
    fontFamily: FONTS.body,
    fontWeight: 700,
    fontSize: 8,
    color: COLORS.inkSoft,
    marginTop: 12,
    marginBottom: 4,
  },
  recordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  recordsCell: {
    width: '32%',
    marginBottom: 3,
  },
  recordsLabel: {
    fontFamily: FONTS.body,
    fontSize: 6,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recordsValue: {
    fontFamily: FONTS.body,
    fontSize: 7.5,
    color: COLORS.ink,
  },
  recordsValueBold: {
    fontFamily: FONTS.body,
    fontWeight: 700,
    fontSize: 7.5,
    color: COLORS.ink,
  },
});

function Checkbox({ checked }) {
  return (
    <View style={{ width: 9, height: 9, borderWidth: 0.8, borderColor: COLORS.ink, marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
      {checked && <View style={{ width: 5, height: 5, backgroundColor: COLORS.orange }} />}
    </View>
  );
}

function CheckboxInline({ checked }) {
  return (
    <View style={{ width: 8, height: 8, borderWidth: 0.7, borderColor: COLORS.ink, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center', display: 'inline' }}>
      {checked && <View style={{ width: 4.5, height: 4.5, backgroundColor: COLORS.orange }} />}
    </View>
  );
}

function SectionTitle({ children }) {
  return (
    <View>
      <Text style={s.sectionHeader}>{children}</Text>
      <View style={s.sectionLine} />
    </View>
  );
}

export default function FundraiserAgreement({ data }) {
  const isWaAsb = data.asb_boosters === 'WA State ASB';
  const isTraditional = (data.product_primary_string || '').includes('Traditional');

  const checkDigital = !isWaAsb && !isTraditional;
  const checkTraditional = isTraditional && !isWaAsb;
  const checkWaAsb = isWaAsb;

  const today = new Date();
  const todayFormatted = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

  // Products table rows
  const productRows = [];
  if (data.primary_product_name) {
    const pctStr = data.primary_product_profit_pct != null
      ? `${Math.round(data.primary_product_profit_pct * 100)}%${isTiered(data.primary_product_name) ? '*' : ''}`
      : '\u2014';
    productRows.push({ name: data.primary_product_name, pct: pctStr });
  }
  if (data.secondary_product_name) {
    const pctStr = data.secondary_product_profit_pct != null
      ? `${Math.round(data.secondary_product_profit_pct * 100)}%${isTiered(data.secondary_product_name) ? '*' : ''}`
      : '\u2014';
    productRows.push({ name: data.secondary_product_name, pct: pctStr });
  }
  if (data.has_tp_donations && data.donations_product_name) {
    const pctStr = data.donations_product_profit_pct != null
      ? `${Math.round(data.donations_product_profit_pct * 100)}%`
      : '\u2014';
    productRows.push({ name: data.donations_product_name, pct: pctStr });
  }

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <ReportHeader title="FUNDRAISER AGREEMENT" />
        <View style={s.content}>
          {/* Top row: intro + details box */}
          <View style={s.topRow}>
            <View style={s.introCol}>
              <Text style={s.introText}>
                SMASH Fundraising ("SMASH") and Organization identified below enter into the following Fundraiser Agreement for the purpose of providing a Fundraising Program designed to facilitate the Organization's fundraising efforts.
              </Text>
            </View>
            <View style={s.detailsBox}>
              <Text style={s.detailsTitle}>Fundraiser Details:</Text>
              <Text style={s.detailsLine}>Start Date: {fmtDate(data.kickoff_date)}</Text>
              <Text style={s.detailsLine}>End Date: {fmtDate(data.end_date)}</Text>
              {productRows.length > 0 && (
                <View>
                  <View style={s.prodTableHeader}>
                    <Text style={[s.prodName, s.prodHeaderText]}>Product</Text>
                    <Text style={[s.prodPct, s.prodHeaderText]}>Profit %</Text>
                  </View>
                  {productRows.map((row, i) => (
                    <View key={i} style={s.prodTableRow}>
                      <Text style={s.prodName}>{row.name}</Text>
                      <Text style={s.prodPct}>{row.pct}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* SMASH agrees to */}
          <SectionTitle>SMASH agrees to:</SectionTitle>
          <Text style={s.listItem}>1. Provide a digital fundraising platform, if applicable.</Text>
          <Text style={s.listItem}>2. Provide any applicable program materials, envelopes, order forms, and pay for any production and printing costs.</Text>
          <Text style={s.listItem}>3. Obtain necessary merchant discounts for any discount product.</Text>
          <Text style={s.listItem}>4. Use its best efforts to assist the Organization with its fundraising efforts.</Text>
          <Text style={s.listItem}>5. To train and provide the Organization with proper materials to conduct the fundraiser.</Text>
          <Text style={s.listItem}>6. Manage funds as agreed below</Text>

          {/* Three checkbox boxes */}
          <View style={s.checkboxRow}>
            <View style={s.checkboxBox}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Checkbox checked={checkDigital} />
                <Text style={s.checkboxLabel}>
                  SMASH will send Organization a check for raised profit after fundraiser close (Digital)
                </Text>
              </View>
            </View>
            <View style={s.checkboxBox}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Checkbox checked={checkTraditional} />
                <Text style={s.checkboxLabel}>
                  Organization will collect funds and SMASH will invoice for gross sales minus Organization profit at close of fundraiser (Traditional)
                </Text>
              </View>
            </View>
            <View style={s.checkboxBox}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Checkbox checked={checkWaAsb} />
                <Text style={s.checkboxLabel}>
                  SMASH will perform daily fund sweeps, issue daily checks to Organization for the cumulative gross funds raised, intact, and invoice Organization for costs at fundraiser close (Digital, WA State ASB Compliant)
                </Text>
              </View>
            </View>
          </View>

          {/* Additional Notes */}
          <Text style={s.notesLabel}>Additional Notes:</Text>
          <Text style={s.notesText}>{data.additional_notes || ' '}</Text>

          {/* School/Organization agrees to */}
          <SectionTitle>School/Organization agrees to:</SectionTitle>
          <Text style={s.listItem}>1. Allow SMASH to operate the fundraiser within their School or Organization.</Text>
          <Text style={s.listItem}>2. Allow SMASH to use its logo for fundraiser-related purposes, including product design, digital platforms, prize incentives, and to display examples of completed fundraiser materials in future promotional content.</Text>
          <Text style={s.listItem}>3. Use their best efforts to sell the product provided at the specified retail price.</Text>
          <Text style={s.listItem}>4. Manage funds as agreed in the previous section.</Text>
          <Text style={s.listItem}>5. (Specific Terms for Discount Card Products Only) Acknowledgement that "best efforts" includes refraining from initiating any competing fundraisers within one month prior to the fundraiser kickoff date without prior approval from SMASH. At the close of the fundraiser, the Organization will return all unsold or unused physical products to SMASH. SMASH retains the right to engage in fundraising activities with other organizations using the same products or partnerships.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3, paddingLeft: 4 }}>
            <Text style={[s.listItem, { marginBottom: 0 }]}>{'6. ASB Fee (ASB Compliant Only): Pay 2% of gross fundraiser revenue to cover costs of daily sweeps and rushed financing. Fee will not be deducted from proceeds; SMASH will invoice the district upon fundraiser completion. Check this box '}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, marginBottom: 6 }}>
            <Checkbox checked={data.rep_pays_asb_fee} />
            <Text style={[s.listItem, { marginBottom: 0 }]}> if representative is waiving this fee.</Text>
          </View>

          {/* Duration, Term, and Termination */}
          <SectionTitle>Duration, Term, and Termination:</SectionTitle>
          <Text style={s.listItem}>1. SMASH and the Organization agree that SMASH shall be the exclusive provider for the fundraising term listed above.</Text>
          <Text style={s.listItem}>2. (Specific Terms for Discount Card Products Only) If for any reason, the Organization cannot perform the fundraiser, the Organization will reimburse SMASH Fundraising for production costs using the following calculations: $20 per applicable merchant signed, plus 25% of any printing, designing, and shipping costs. The Organization acknowledges that these costs are a reasonable approximation of actual damages to SMASH.</Text>

          {/* Signature block */}
          <View style={s.sigBlock}>
            {/* Row 1: blank org signature */}
            <View style={s.sigRow}>
              <View style={s.sigCell}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Authorized Organization Representative (Signature)</Text>
              </View>
              <View style={s.sigRow}>
                <View style={s.sigCell}>
                  <View style={s.sigLine} />
                  <Text style={s.sigLabel}>Print Name & Title</Text>
                </View>
                <View style={s.sigCell}>
                  <View style={s.sigLine} />
                  <Text style={s.sigLabel}>Date</Text>
                </View>
              </View>
            </View>
            {/* Row 2: Krista's signature */}
            <View style={s.sigRow}>
              <View style={s.sigCell}>
                <View style={s.sigLineWithContent}>
                  <Text style={s.sigName}>Krista McGaughy</Text>
                </View>
                <Text style={s.sigLabel}>Authorized SMASH Fundraising Representative (Signature)</Text>
              </View>
              <View style={s.sigRow}>
                <View style={s.sigCell}>
                  <View style={s.sigLineWithContent}>
                    <Text style={s.sigPrintName}>Krista McGaughy, Business Manager</Text>
                  </View>
                  <Text style={s.sigLabel}>Print Name & Title</Text>
                </View>
                <View style={s.sigCell}>
                  <View style={s.sigLineWithContent}>
                    <Text style={s.sigDate}>{todayFormatted}</Text>
                  </View>
                  <Text style={s.sigLabel}>Date</Text>
                </View>
              </View>
            </View>
          </View>

          {/* For SMASH Records */}
          <Text style={s.recordsHeader}>For SMASH Records:</Text>
          <View style={s.recordsGrid}>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>School/Organization</Text>
              <Text style={s.recordsValueBold}>{data.organization}</Text>
              <Text style={s.recordsValue}>{data.team}</Text>
            </View>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>SMASH Representative</Text>
              <Text style={s.recordsValue}>{data.rep_name || '\u2014'}</Text>
            </View>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>SMASH Record #</Text>
              <Text style={s.recordsValue}>{data.fundraiser_id || '\u2014'}</Text>
            </View>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>Coach/Leader Name</Text>
              <Text style={s.recordsValue}>{data.primary_contact_name || '\u2014'}</Text>
            </View>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>Coach/Leader Email</Text>
              <Text style={s.recordsValue}>{data.primary_contact_email || '\u2014'}</Text>
            </View>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>Acct Contact Name</Text>
              <Text style={s.recordsValue}>{data.accounting_contact_name || '\u2014'}</Text>
            </View>
            <View style={s.recordsCell}>
              <Text style={s.recordsLabel}>Acct Contact Email</Text>
              <Text style={s.recordsValue}>{data.accounting_contact_email || '\u2014'}</Text>
            </View>
          </View>

          <Footer />
        </View>
      </Page>
    </Document>
  );
}
