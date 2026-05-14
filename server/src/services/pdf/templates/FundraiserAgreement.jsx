import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { COLORS, FONTS, SIZES, PAGE } from '../styles.js';
import Footer from '../components/Footer.jsx';
import { isTiered } from '../../../constants/tieredProducts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoPath = join(__dirname, '..', '..', '..', 'assets', 'images', 'smash-logo-black.png');

const BLACK = '#000000';

const fmtDate = (d) => {
  if (!d) return 'TBD';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
};

const s = StyleSheet.create({
  page: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 9,
    paddingTop: 0,
    paddingBottom: 30,
  },
  content: {
    paddingHorizontal: PAGE.paddingHorizontal,
    flex: 1,
  },
  // Custom header
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: BLACK,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: PAGE.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLogo: { width: 110 },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontWeight: 900,
    fontSize: 22,
    color: BLACK,
    letterSpacing: 1,
    textTransform: 'uppercase',
    lineHeight: 1,
    marginBottom: -5,
  },
  // Intro
  intro: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 9,
    color: COLORS.ink,
    lineHeight: 1.5,
    marginTop: 8,
    marginBottom: 4,
  },
  // Black banner
  banner: {
    backgroundColor: BLACK,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 3,
  },
  bannerText: {
    color: COLORS.white,
    fontFamily: FONTS.body,
    fontWeight: 700,
    fontSize: 8,
  },
  // Two-column layout
  twoCol: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 5,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    width: '35%',
  },
  // Numbered list
  listItem: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 9,
    color: COLORS.ink,
    lineHeight: 1.4,
    marginBottom: 1,
  },
  // Checkbox row
  checkboxRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  checkboxCell: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  checkboxText: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 6.8,
    lineHeight: 1.4,
    flex: 1,
  },
  // Details box
  detailsBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailsLabel: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 8,
    color: COLORS.inkSoft,
    width: 55,
  },
  detailsValue: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 8,
    color: COLORS.ink,
  },
  // Product table
  prodRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  prodName: {
    flex: 1,
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 7.5,
    color: COLORS.ink,
  },
  prodPct: {
    width: 42,
    textAlign: 'right',
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 7.5,
    color: COLORS.ink,
  },
  // Notes box
  notesBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
    minHeight: 30,
  },
  notesText: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 6,
    color: COLORS.ink,
    lineHeight: 1.4,
    padding: 6,
  },
  // Signature block
  sigBlock: {
    marginTop: 8,
  },
  sigRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 6,
  },
  sigCellWide: {
    flex: 3,
  },
  sigCellNarrow: {
    flex: 2,
  },
  sigCellDate: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.ink,
    height: 18,
    justifyContent: 'flex-end',
  },
  sigLabel: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 6.5,
    color: COLORS.inkMuted,
    marginTop: 1,
  },
  sigName: {
    fontFamily: FONTS.signature,
    fontSize: 22,
    color: COLORS.ink,
  },
  sigPrint: {
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 8,
    color: COLORS.ink,
    paddingBottom: 1,
  },
  // Records table
  recordsTable: {
    marginTop: 3,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  recordsRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  recordsLabel: {
    backgroundColor: COLORS.surface,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    fontFamily: FONTS.body,
    fontSize: 7,
    color: COLORS.inkSoft,
    fontWeight: 700,
    borderRightWidth: 0.5,
    borderRightColor: COLORS.border,
  },
  recordsValue: {
    backgroundColor: COLORS.white,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    fontFamily: FONTS.body,
    fontWeight: 400,
    fontSize: 7,
    color: COLORS.ink,
    borderRightWidth: 0.5,
    borderRightColor: COLORS.border,
  },
});

function Banner({ children, style }) {
  return (
    <View style={[s.banner, style]}>
      <Text style={s.bannerText}>{children}</Text>
    </View>
  );
}

function BannerTwoCol({ left, right, style }) {
  return (
    <View style={[s.banner, { flexDirection: 'row', justifyContent: 'space-between' }, style]}>
      <Text style={s.bannerText}>{left}</Text>
      <Text style={s.bannerText}>{right}</Text>
    </View>
  );
}

function Checkbox({ checked, size = 8 }) {
  if (!checked) {
    return (
      <View style={{
        width: size,
        height: size,
        borderWidth: 0.8,
        borderColor: COLORS.inkMuted,
        marginTop: 1,
        flexShrink: 0,
      }} />
    );
  }
  return (
    <View style={{ width: size, height: size, flexShrink: 0, marginTop: 1, position: 'relative' }}>
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        borderWidth: 0.8,
        borderColor: BLACK,
      }} />
      <Text style={{
        position: 'absolute',
        top: -(size * 0.95),
        left: -(size * 0.15),
        fontSize: size + 8,
        fontFamily: FONTS.body,
        fontWeight: 900,
        color: BLACK,
        lineHeight: 1,
      }}>
        {'✓'}
      </Text>
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

  // Build product rows
  const productRows = [];
  if (data.primary_product_name) {
    const pct = data.primary_product_profit_pct != null
      ? `${Math.round(data.primary_product_profit_pct * 100)}%${isTiered(data.primary_product_name) ? '*' : ''}`
      : '\u2014';
    productRows.push({ name: data.primary_product_name, pct });
  }
  if (data.secondary_product_name) {
    const pct = data.secondary_product_profit_pct != null
      ? `${Math.round(data.secondary_product_profit_pct * 100)}%${isTiered(data.secondary_product_name) ? '*' : ''}`
      : '\u2014';
    productRows.push({ name: data.secondary_product_name, pct });
  }
  if (data.has_tp_donations && data.donations_product_name) {
    const pct = data.donations_product_profit_pct != null
      ? `${Math.round(data.donations_product_profit_pct * 100)}%`
      : '\u2014';
    productRows.push({ name: data.donations_product_name, pct });
  }

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Custom header — white bg, black logo, title in Nohemi, thick bottom rule */}
        <View style={s.header}>
          <Image src={logoPath} style={s.headerLogo} />
          <Text style={s.headerTitle}>Fundraiser Agreement</Text>
        </View>

        <View style={s.content}>
          {/* Intro */}
          <Text style={s.intro}>
            SMASH Fundraising ("SMASH") and Organization identified below enter into the following Fundraiser Agreement for the purpose of providing a Fundraising Program designed to facilitate the Organization's fundraising efforts.
          </Text>

          {/* Two-column: SMASH agrees (left) + Details (right) */}
          <View style={s.twoCol}>
            {/* LEFT COLUMN */}
            <View style={s.leftCol}>
              <Banner>SMASH agrees to:</Banner>
              <Text style={s.listItem}>1. Provide a digital fundraising platform, if applicable.</Text>
              <Text style={s.listItem}>2. Provide any applicable program materials, envelopes, order forms, and pay for any production and printing costs.</Text>
              <Text style={s.listItem}>3. Obtain necessary merchant discounts for any discount product.</Text>
              <Text style={s.listItem}>4. Use its best efforts to assist the Organization with its fundraising efforts.</Text>
              <Text style={[s.listItem, { fontSize: 8.5 }]}>5. To train and provide the Organization with proper materials to conduct the fundraiser.</Text>
              <Text style={s.listItem}>6. Manage funds as agreed below</Text>

              {/* Three checkbox boxes */}
              <View style={s.checkboxRow}>
                <View style={[s.checkboxCell, { flex: 2.8, marginRight: 10 }]}>
                  <Checkbox checked={checkDigital} />
                  <Text style={[s.checkboxText, { color: checkDigital ? COLORS.ink : COLORS.inkMuted, fontWeight: checkDigital ? 700 : 400 }]}>
                    SMASH will send Organization a check for raised profit after fundraiser close (Digital)
                  </Text>
                </View>
                <View style={[s.checkboxCell, { flex: 3.4, marginRight: 16 }]}>
                  <Checkbox checked={checkTraditional} />
                  <Text style={[s.checkboxText, { color: checkTraditional ? COLORS.ink : COLORS.inkMuted, fontWeight: checkTraditional ? 700 : 400 }]}>
                    Organization will collect funds and SMASH will invoice for gross sales minus Organization profit at close of fundraiser (Traditional)
                  </Text>
                </View>
                <View style={[s.checkboxCell, { flex: 5 }]}>
                  <Checkbox checked={checkWaAsb} />
                  <Text style={[s.checkboxText, { color: checkWaAsb ? COLORS.ink : COLORS.inkMuted, fontWeight: checkWaAsb ? 700 : 400 }]}>
                    SMASH will perform daily fund sweeps, issue daily checks to Organization for the cumulative gross funds raised, intact, and invoice Organization for costs at fundraiser close (Digital, WA State ASB Compliant)
                  </Text>
                </View>
              </View>
            </View>

            {/* RIGHT COLUMN */}
            <View style={s.rightCol}>
              {/* Fundraiser Details box */}
              <View style={s.detailsBox}>
                <Banner style={{ marginBottom: 0 }}>Fundraiser Details:</Banner>
                <View style={s.detailsRow}>
                  <Text style={s.detailsLabel}>Start Date</Text>
                  <Text style={s.detailsValue}>{fmtDate(data.kickoff_date)}</Text>
                </View>
                <View style={[s.detailsRow, { borderBottomWidth: 0.5, borderBottomColor: COLORS.border, paddingBottom: 4 }]}>
                  <Text style={s.detailsLabel}>End Date</Text>
                  <Text style={s.detailsValue}>{fmtDate(data.end_date)}</Text>
                </View>
                <BannerTwoCol left="Product" right="Profit %" style={{ marginBottom: 0, marginTop: 0 }} />
                {productRows.map((row, i) => (
                  <View key={i} style={[s.prodRow, i === productRows.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={s.prodName}>{row.name}</Text>
                    <Text style={s.prodPct}>{row.pct}</Text>
                  </View>
                ))}
              </View>

              {/* Additional Notes box */}
              <View style={s.notesBox}>
                <Banner style={{ marginBottom: 0 }}>Additional Notes:</Banner>
                {data.additional_notes ? (
                  <Text style={s.notesText}>{data.additional_notes}</Text>
                ) : (
                  <View style={{ height: 16 }} />
                )}
              </View>
            </View>
          </View>

          {/* School/Organization agrees to */}
          <Banner style={{ marginTop: 5 }}>School/Organization agrees to:</Banner>
          <Text style={s.listItem}>1. Allow SMASH to operate the fundraiser within their School or Organization.</Text>
          <Text style={s.listItem}>2. Allow SMASH to use its logo for fundraiser-related purposes, including product design, digital platforms, prize incentives, and to display examples of completed fundraiser materials in future promotional content.</Text>
          <Text style={s.listItem}>3. Use their best efforts to sell the product provided at the specified retail price.</Text>
          <Text style={s.listItem}>4. Manage funds as agreed in the previous section.</Text>
          <Text style={s.listItem}>5. (Specific Terms for Discount Card Products Only) Acknowledgement that "best efforts" includes refraining from initiating any competing fundraisers within one month prior to the fundraiser kickoff date without prior approval from SMASH. At the close of the fundraiser, the Organization will return all unsold or unused physical products to SMASH. SMASH retains the right to engage in fundraising activities with other organizations using the same products or partnerships.</Text>
          <Text style={s.listItem}>
            {'6. ASB Fee (ASB Compliant Only): Pay 2% of gross fundraiser revenue to cover costs of daily sweeps and rushed financing. Fee will not be deducted from proceeds; SMASH will invoice the district upon fundraiser completion.'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
            <Text style={[s.listItem, { marginBottom: 0 }]}>{'Check this box '}</Text>
            <Checkbox checked={data.rep_pays_asb_fee} size={8} />
            <Text style={[s.listItem, { marginBottom: 0, marginLeft: 4 }]}>{' if representative is waiving this fee.'}</Text>
          </View>

          {/* Duration, Term, and Termination */}
          <Banner style={{ marginTop: 5 }}>Duration, Term, and Termination:</Banner>
          <Text style={s.listItem}>1. SMASH and the Organization agree that SMASH shall be the exclusive provider for the fundraising term listed above.</Text>
          <Text style={s.listItem}>2. (Specific Terms for Discount Card Products Only) If for any reason, the Organization cannot perform the fundraiser, the Organization will reimburse SMASH Fundraising for production costs using the following calculations: $20 per applicable merchant signed, plus 25% of any printing, designing, and shipping costs. The Organization acknowledges that these costs are a reasonable approximation of actual damages to SMASH.</Text>

          {/* Signature block */}
          <View style={s.sigBlock}>
            {/* Row 1: blank org rep */}
            <View style={s.sigRow}>
              <View style={s.sigCellWide}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Authorized Organization Representative (Signature)</Text>
              </View>
              <View style={s.sigCellNarrow}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Print Name & Title</Text>
              </View>
              <View style={s.sigCellDate}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Date</Text>
              </View>
            </View>
            {/* Row 2: Krista's signature */}
            <View style={s.sigRow}>
              <View style={s.sigCellWide}>
                <Text style={s.sigName}>Krista McGaughy</Text>
                <View style={{ borderBottomWidth: 0.5, borderBottomColor: COLORS.ink }} />
                <Text style={s.sigLabel}>Authorized SMASH Fundraising Representative (Signature)</Text>
              </View>
              <View style={[s.sigCellNarrow, { paddingTop: 10 }]}>
                <View style={[s.sigLine, { justifyContent: 'flex-end' }]}>
                  <Text style={s.sigPrint}>Krista McGaughy, Business Manager</Text>
                </View>
                <Text style={s.sigLabel}>Print Name & Title</Text>
              </View>
              <View style={[s.sigCellDate, { paddingTop: 10 }]}>
                <View style={[s.sigLine, { justifyContent: 'flex-end' }]}>
                  <Text style={s.sigPrint}>{todayFormatted}</Text>
                </View>
                <Text style={s.sigLabel}>Date</Text>
              </View>
            </View>
          </View>

          {/* For SMASH Records */}
          <Banner style={{ marginTop: 5 }}>For SMASH Records:</Banner>
          <View style={s.recordsTable}>
            <View style={s.recordsRow}>
              <Text style={[s.recordsLabel, { width: '18%' }]}>School/Organization</Text>
              <Text style={[s.recordsValue, { width: '32%' }]}>{data.organization || '\u2014'}</Text>
              <Text style={[s.recordsLabel, { width: '18%' }]}>Group</Text>
              <Text style={[s.recordsValue, { width: '32%', borderRightWidth: 0 }]}>{data.team || '\u2014'}</Text>
            </View>
            <View style={s.recordsRow}>
              <Text style={[s.recordsLabel, { width: '18%' }]}>SMASH Representative</Text>
              <Text style={[s.recordsValue, { width: '32%' }]}>{data.rep_name || '\u2014'}</Text>
              <Text style={[s.recordsLabel, { width: '18%' }]}>SMASH Record #</Text>
              <Text style={[s.recordsValue, { width: '32%', borderRightWidth: 0 }]}>{data.fundraiser_id || '\u2014'}</Text>
            </View>
            <View style={s.recordsRow}>
              <Text style={[s.recordsLabel, { width: '18%' }]}>Coach/Leader Name</Text>
              <Text style={[s.recordsValue, { width: '32%' }]}>{data.primary_contact_name || '\u2014'}</Text>
              <Text style={[s.recordsLabel, { width: '18%' }]}>Coach/Leader Email</Text>
              <Text style={[s.recordsValue, { width: '32%', borderRightWidth: 0 }]}>{data.primary_contact_email || '\u2014'}</Text>
            </View>
            <View style={[s.recordsRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.recordsLabel, { width: '18%' }]}>Acct Contact Name</Text>
              <Text style={[s.recordsValue, { width: '32%' }]}>{data.accounting_contact_name || '\u2014'}</Text>
              <Text style={[s.recordsLabel, { width: '18%' }]}>Acct Contact Email</Text>
              <Text style={[s.recordsValue, { width: '32%', borderRightWidth: 0 }]}>{data.accounting_contact_email || '\u2014'}</Text>
            </View>
          </View>

          <Footer />
        </View>
      </Page>
    </Document>
  );
}
