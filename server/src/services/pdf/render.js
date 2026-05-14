import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { registerFonts } from './fonts.js';
import FundraiserProfitReport from './templates/FundraiserProfitReport.jsx';
import RepCommissionReport from './templates/RepCommissionReport.jsx';
import FundraiserAgreement from './templates/FundraiserAgreement.jsx';

registerFonts();

export async function renderFpr(data) {
  return renderToBuffer(React.createElement(FundraiserProfitReport, { data }));
}

export async function renderRcr(data) {
  return renderToBuffer(React.createElement(RepCommissionReport, { data }));
}

export async function renderAgreement(data) {
  return renderToBuffer(React.createElement(FundraiserAgreement, { data }));
}
