const qrcode = require('qrcode');
const sharp = require('sharp');

/**
 * Production-ready, zero-dependency PDF generation engine conforming to ISO 32000-1 (PDF 1.4).
 * Produces crisp, print-ready A4 landscape or portrait certificates with vector graphics,
 * ornate borders, dynamic token placeholders, and vector QR verification codes.
 */
class PdfGenerator {
  constructor() {
    // Page dimensions in PDF points (1 pt = 1/72 inch; 25.4 mm = 72 pt)
    // A4 dimensions: 210mm x 297mm -> 595.28 pt x 841.89 pt
    this.PAGE_SIZES = {
      A4: { width: 595.28, height: 841.89 },
      Letter: { width: 612.0, height: 792.0 },
    };
  }

  /**
   * Escape special characters in PDF literal text strings.
   */
  escapePdfString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, ' ');
  }

  /**
   * Convert HEX color string (e.g. #D4AF37) to normalized RGB floats (0.0 - 1.0).
   */
  hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 0.1, g: 0.1, b: 0.1 };
    let clean = hex.replace(/^#/, '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    if (clean.length !== 6) return { r: 0.1, g: 0.1, b: 0.1 };
    const num = parseInt(clean, 16);
    return {
      r: Number(((num >> 16) & 255) / 255).toFixed(3),
      g: Number(((num >> 8) & 255) / 255).toFixed(3),
      b: Number((num & 255) / 255).toFixed(3),
    };
  }

  /**
   * Replace dynamic placeholders in text strings.
   * e.g. {{studentName}}, {{grade}}, {{certificateId}}
   */
  interpolatePlaceholders(text, context) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, token) => {
      if (context[token] !== undefined && context[token] !== null) {
        return String(context[token]);
      }
      return match;
    });
  }

  /**
   * Approximate width of a text string for text centering.
   */
  estimateTextWidth(text, fontSize = 12, isBold = false) {
    const factor = isBold ? 0.58 : 0.52;
    return String(text || '').length * fontSize * factor;
  }

  /**
   * Generate vector PDF stream commands for the QR code.
   */
  generateQrCodeCommands(verificationUrl, x, y, size) {
    let commands = '';
    try {
      const qr = qrcode.create(verificationUrl, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const cellSize = size / moduleCount;

      // Draw white background for QR
      commands += '1 1 1 rg\n';
      commands += `${x - 4} ${y - 4} ${size + 8} ${size + 8} re f\n`;

      // Draw black vector modules
      commands += '0 0 0 rg\n';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            const cellX = (x + c * cellSize).toFixed(2);
            const cellY = (y + (moduleCount - 1 - r) * cellSize).toFixed(2);
            const w = (cellSize + 0.1).toFixed(2);
            const h = (cellSize + 0.1).toFixed(2);
            commands += `${cellX} ${cellY} ${w} ${h} re f\n`;
          }
        }
      }
    } catch (e) {
      console.warn('[PdfGenerator] QR Code generation fallback:', e.message);
    }
    return commands;
  }

  /**
   * Escape XML/SVG special characters safely.
   */
  escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Resolve unified certificate branding, academic snapshot, and verification link
   * shared across PDF, PNG, and JPG/JPEG exports.
   */
  resolveCertificateContext({ certificate, template, systemSetting, verificationUrl }) {
    const snap = certificate.academicSnapshot || {};
    const issueDate = certificate.issuedAt
      ? new Date(certificate.issuedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    const certSetting = systemSetting?.certification || {};
    const institutionName =
      template?.branding?.institutionName ||
      certSetting.institutionName ||
      'Unified Assessment Platform';

    const signatoryName =
      snap.signatoryName ||
      template?.branding?.signatoryName ||
      certSetting.defaultSignatoryName ||
      'Dean of Academic Affairs';

    const signatoryTitle =
      snap.signatoryTitle ||
      template?.branding?.signatoryTitle ||
      certSetting.defaultSignatoryTitle ||
      'Dean of Academic Affairs';

    const context = {
      studentName: snap.studentName || 'Student',
      studentIdNumber: snap.studentIdNumber || '',
      studentEmail: snap.studentEmail || '',
      assessmentTitle: snap.assessmentTitle || 'Assessment',
      certificateTitle: snap.certificateTitle || `${snap.assessmentTitle || 'Course'} Certificate of Completion`,
      category: snap.category || 'General',
      score: snap.score !== undefined ? snap.score : 0,
      totalPoints: snap.totalPoints || 100,
      percentage: snap.percentage !== undefined ? snap.percentage : 0,
      grade: snap.grade || 'Pass',
      gradeLabel: snap.gradeLabel || '',
      passingPercentage: snap.passingPercentage || 60,
      issueDate,
      certificateId: certificate.certificateId,
      verificationCode: certificate.verificationCode,
      instructorName: snap.instructorName || 'Faculty Lead',
      signatoryName,
      signatoryTitle,
      institutionName,
    };

    const verifyLink =
      verificationUrl ||
      `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify/${certificate.verificationCode}`;

    return { context, verifyLink, institutionName, signatoryName, signatoryTitle };
  }

  /**
   * Render a crisp PNG or JPG/JPEG certificate image from the authoritative certificate record.
   */
  async generateCertificateImage({ certificate, template, systemSetting, verificationUrl, format = 'png' }) {
    const normFormat = String(format || 'png').toLowerCase().trim();
    if (!['png', 'jpg', 'jpeg'].includes(normFormat)) {
      const err = new Error('Unsupported image format. Supported formats: png, jpg, jpeg.');
      err.statusCode = 400;
      throw err;
    }

    const { context, verifyLink, institutionName } = this.resolveCertificateContext({
      certificate,
      template,
      systemSetting,
      verificationUrl,
    });

    const width = 1600;
    const height = 1131;
    const canvasBg = template?.canvas?.backgroundColor || '#FFFFFF';
    const borderStyle = template?.canvas?.borderStyle || 'classic-gold';
    const borderColor =
      template?.canvas?.borderColor || (borderStyle === 'modern-slate' ? '#475569' : '#D4AF37');

    let qrSvgInner = '';
    try {
      const rawQrSvg = await qrcode.toString(verifyLink, {
        type: 'svg',
        margin: 1,
        width: 140,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });
      qrSvgInner = rawQrSvg.replace(/<\?xml[^>]*\?>/g, '').trim();
    } catch (qrErr) {
      console.warn('[PdfGenerator] SVG QR generation fallback:', qrErr.message);
    }

    const borderMarkup =
      borderStyle === 'none'
        ? ''
        : `
      <rect x="36" y="36" width="${width - 72}" height="${height - 72}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="6" />
      <rect x="52" y="52" width="${width - 104}" height="${height - 104}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="2" />
      <rect x="46" y="46" width="12" height="12" fill="${this.escapeXml(borderColor)}" />
      <rect x="${width - 58}" y="46" width="12" height="12" fill="${this.escapeXml(borderColor)}" />
      <rect x="46" y="${height - 58}" width="12" height="12" fill="${this.escapeXml(borderColor)}" />
      <rect x="${width - 58}" y="${height - 58}" width="12" height="12" fill="${this.escapeXml(borderColor)}" />
    `;

    const idBlock = context.studentIdNumber
      ? `<text x="${width / 2}" y="458" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#64748B">Institutional ID: ${this.escapeXml(context.studentIdNumber)}</text>`
      : '';

    const metricLine = `Score: ${context.percentage}%   |   Grade: ${context.grade}${
      context.gradeLabel ? ` (${context.gradeLabel})` : ''
    }   |   Passing Threshold: ${context.passingPercentage}%`;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${this.escapeXml(canvasBg)}" />
  ${borderMarkup}

  <text x="${width / 2}" y="138" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" font-weight="bold" letter-spacing="3" fill="#475569">${this.escapeXml(institutionName.toUpperCase())}</text>
  <line x1="480" y1="162" x2="1120" y2="162" stroke="${this.escapeXml(borderColor)}" stroke-width="3" />

  <text x="${width / 2}" y="236" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="50" font-weight="bold" fill="#B45309">CERTIFICATE OF ACHIEVEMENT</text>
  <text x="${width / 2}" y="294" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-style="italic" fill="#475569">This is proudly and authoritatively presented to</text>

  <text x="${width / 2}" y="410" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="56" font-weight="bold" fill="#1E293B">${this.escapeXml((context.studentName || 'Recipient').toUpperCase())}</text>
  ${idBlock}
  <line x1="420" y1="486" x2="1180" y2="486" stroke="${this.escapeXml(borderColor)}" stroke-width="2" />

  <text x="${width / 2}" y="544" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#475569">for successfully satisfying all qualifying academic and examination requirements for</text>
  <text x="${width / 2}" y="616" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" font-weight="bold" fill="#1E293B">${this.escapeXml(context.certificateTitle)}</text>
  <text x="${width / 2}" y="662" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#334155">Assessment: ${this.escapeXml(context.assessmentTitle)}</text>
  <text x="${width / 2}" y="712" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#334155">${this.escapeXml(metricLine)}</text>

  <!-- Left Signatory -->
  <line x1="170" y1="905" x2="510" y2="905" stroke="#94A3B8" stroke-width="2" />
  <text x="340" y="940" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#1E293B">${this.escapeXml(context.signatoryName)}</text>
  <text x="340" y="970" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#64748B">${this.escapeXml(context.signatoryTitle)}</text>

  <!-- Center QR & Verification -->
  <g transform="translate(${(width - 140) / 2}, 790)">
    ${qrSvgInner}
  </g>
  <text x="${width / 2}" y="965" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="bold" fill="#334155">Certificate ID: ${this.escapeXml(context.certificateId)}</text>
  <text x="${width / 2}" y="995" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#64748B">Issued: ${this.escapeXml(context.issueDate)}  |  Verification: ${this.escapeXml(context.verificationCode)}</text>

  <!-- Right Evaluator -->
  <line x1="1090" y1="905" x2="1430" y2="905" stroke="#94A3B8" stroke-width="2" />
  <text x="1260" y="940" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#1E293B">${this.escapeXml(context.instructorName)}</text>
  <text x="1260" y="970" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#64748B">Academic Instructor &amp; Evaluator</text>
</svg>`;

    const pipeline = sharp(Buffer.from(svg, 'utf-8'));
    if (normFormat === 'jpg' || normFormat === 'jpeg') {
      return pipeline
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    }
    return pipeline.png({ compressionLevel: 9 }).toBuffer();
  }

  /**
   * Main certificate generation method.
   * Accepts certificate document, template snapshot/doc, and institutional context.
   * Returns a complete, valid PDF Buffer.
   */
  async generateCertificatePdf({ certificate, template, systemSetting, verificationUrl }) {
    const snap = certificate.academicSnapshot || {};
    const orientation = template?.orientation || 'landscape';
    const pageSizeKey = template?.pageSize === 'Letter' ? 'Letter' : 'A4';
    const baseDimensions = this.PAGE_SIZES[pageSizeKey];

    const width = orientation === 'landscape' ? baseDimensions.height : baseDimensions.width;
    const height = orientation === 'landscape' ? baseDimensions.width : baseDimensions.height;

    const { context, verifyLink, institutionName, signatoryName, signatoryTitle } =
      this.resolveCertificateContext({ certificate, template, systemSetting, verificationUrl });

    // Assemble PDF vector stream commands
    let stream = '';

    // 1. Background fill
    const canvasBg = template?.canvas?.backgroundColor || '#FFFFFF';
    const bgRgb = this.hexToRgb(canvasBg);
    stream += `${bgRgb.r} ${bgRgb.g} ${bgRgb.b} rg\n`;
    stream += `0 0 ${width} ${height} re f\n`;

    // 2. Borders
    const borderStyle = template?.canvas?.borderStyle || 'classic-gold';
    const borderColor = template?.canvas?.borderColor || (borderStyle === 'modern-slate' ? '#475569' : '#D4AF37');
    const borderRgb = this.hexToRgb(borderColor);

    if (borderStyle !== 'none') {
      // Outer primary border
      stream += `${borderRgb.r} ${borderRgb.g} ${borderRgb.b} RG\n`;
      stream += '4 w\n';
      stream += `24 24 ${width - 48} ${height - 48} re S\n`;

      // Inner thin accent border
      stream += '1 w\n';
      stream += `30 30 ${width - 60} ${height - 60} re S\n`;

      // Corner decorative embellishments (diamonds)
      const corners = [
        { x: 30, y: 30 },
        { x: width - 30, y: 30 },
        { x: 30, y: height - 30 },
        { x: width - 30, y: height - 30 },
      ];
      stream += `${borderRgb.r} ${borderRgb.g} ${borderRgb.b} rg\n`;
      for (const c of corners) {
        stream += `${c.x - 3} ${c.y - 3} 6 6 re f\n`;
      }
    }

    // 3. Institutional Header
    const primaryColor = this.hexToRgb('#1E293B');
    const accentColor = this.hexToRgb('#B45309');
    const secondaryColor = this.hexToRgb('#475569');

    // Institution Name
    stream += 'BT\n';
    stream += '/F2 16 Tf\n';
    stream += `${secondaryColor.r} ${secondaryColor.g} ${secondaryColor.b} rg\n`;
    const instText = institutionName.toUpperCase();
    const instWidth = this.estimateTextWidth(instText, 16, true);
    stream += `${((width - instWidth) / 2).toFixed(2)} ${height - 70} Td\n`;
    stream += `(${this.escapePdfString(instText)}) Tj\n`;
    stream += 'ET\n';

    // Thin header divider rule
    stream += `${borderRgb.r} ${borderRgb.g} ${borderRgb.b} RG\n`;
    stream += '1.5 w\n';
    stream += `${((width - 320) / 2).toFixed(2)} ${height - 82} m ${((width + 320) / 2).toFixed(2)} ${height - 82} l S\n`;

    // Title: Certificate of Achievement
    stream += 'BT\n';
    stream += '/F2 26 Tf\n';
    stream += `${accentColor.r} ${accentColor.g} ${accentColor.b} rg\n`;
    const awardTitle = 'CERTIFICATE OF ACHIEVEMENT';
    const awardWidth = this.estimateTextWidth(awardTitle, 26, true);
    stream += `${((width - awardWidth) / 2).toFixed(2)} ${height - 120} Td\n`;
    stream += `(${this.escapePdfString(awardTitle)}) Tj\n`;
    stream += 'ET\n';

    // Subtitle phrase
    stream += 'BT\n';
    stream += '/F3 13 Tf\n';
    stream += `${secondaryColor.r} ${secondaryColor.g} ${secondaryColor.b} rg\n`;
    const presText = 'This is proudly and authoritatively presented to';
    const presWidth = this.estimateTextWidth(presText, 13, false);
    stream += `${((width - presWidth) / 2).toFixed(2)} ${height - 150} Td\n`;
    stream += `(${this.escapePdfString(presText)}) Tj\n`;
    stream += 'ET\n';

    // Recipient Student Name
    stream += 'BT\n';
    stream += '/F2 28 Tf\n';
    stream += `${primaryColor.r} ${primaryColor.g} ${primaryColor.b} rg\n`;
    const studentName = (context.studentName || 'Recipient').toUpperCase();
    const studentWidth = this.estimateTextWidth(studentName, 28, true);
    stream += `${((width - studentWidth) / 2).toFixed(2)} ${height - 195} Td\n`;
    stream += `(${this.escapePdfString(studentName)}) Tj\n`;
    stream += 'ET\n';

    // Student ID if available
    if (context.studentIdNumber) {
      stream += 'BT\n';
      stream += '/F1 10 Tf\n';
      stream += '0.4 0.45 0.5 rg\n';
      const idText = `Institutional ID: ${context.studentIdNumber}`;
      const idWidth = this.estimateTextWidth(idText, 10, false);
      stream += `${((width - idWidth) / 2).toFixed(2)} ${height - 212} Td\n`;
      stream += `(${this.escapePdfString(idText)}) Tj\n`;
      stream += 'ET\n';
    }

    // Name underline accent
    stream += `${borderRgb.r} ${borderRgb.g} ${borderRgb.b} RG\n`;
    stream += '1 w\n';
    const lineY = context.studentIdNumber ? height - 222 : height - 208;
    stream += `${((width - Math.max(studentWidth, 260)) / 2).toFixed(2)} ${lineY} m ${((width + Math.max(studentWidth, 260)) / 2).toFixed(2)} ${lineY} l S\n`;

    // Completion statement
    stream += 'BT\n';
    stream += '/F1 12 Tf\n';
    stream += `${secondaryColor.r} ${secondaryColor.g} ${secondaryColor.b} rg\n`;
    const stmtText = 'for successfully satisfying all qualifying academic and examination requirements for';
    const stmtWidth = this.estimateTextWidth(stmtText, 12, false);
    stream += `${((width - stmtWidth) / 2).toFixed(2)} ${lineY - 26} Td\n`;
    stream += `(${this.escapePdfString(stmtText)}) Tj\n`;
    stream += 'ET\n';

    // Assessment / Credential Title
    stream += 'BT\n';
    stream += '/F2 20 Tf\n';
    stream += `${primaryColor.r} ${primaryColor.g} ${primaryColor.b} rg\n`;
    const certTitle = context.certificateTitle || context.assessmentTitle;
    const certWidth = this.estimateTextWidth(certTitle, 20, true);
    stream += `${((width - certWidth) / 2).toFixed(2)} ${lineY - 56} Td\n`;
    stream += `(${this.escapePdfString(certTitle)}) Tj\n`;
    stream += 'ET\n';

    // Academic Performance metrics block
    const scoreText = `Score: ${context.percentage}%  |  Grade: ${context.grade}${context.gradeLabel ? ` (${context.gradeLabel})` : ''}  |  Passing Threshold: ${context.passingPercentage}%`;
    stream += 'BT\n';
    stream += '/F1 11 Tf\n';
    stream += '0.25 0.35 0.45 rg\n';
    const scoreWidth = this.estimateTextWidth(scoreText, 11, false);
    stream += `${((width - scoreWidth) / 2).toFixed(2)} ${lineY - 84} Td\n`;
    stream += `(${this.escapePdfString(scoreText)}) Tj\n`;
    stream += 'ET\n';

    // 4. Signatures & Verification Row (Bottom Section)
    const bottomY = 75;

    // Left: Authorized Signatory
    stream += '0.3 0.35 0.4 RG\n';
    stream += '1 w\n';
    stream += `60 ${bottomY + 36} m 240 ${bottomY + 36} l S\n`;

    stream += 'BT\n';
    stream += '/F2 11 Tf\n';
    stream += '0.15 0.2 0.25 rg\n';
    stream += `60 ${bottomY + 22} Td\n`;
    stream += `(${this.escapePdfString(context.signatoryName)}) Tj\n`;
    stream += 'ET\n';

    stream += 'BT\n';
    stream += '/F1 9 Tf\n';
    stream += '0.45 0.5 0.55 rg\n';
    stream += `60 ${bottomY + 10} Td\n`;
    stream += `(${this.escapePdfString(context.signatoryTitle)}) Tj\n`;
    stream += 'ET\n';

    // Right: Faculty / Department Lead
    const rightX = width - 240;
    stream += '0.3 0.35 0.4 RG\n';
    stream += '1 w\n';
    stream += `${rightX} ${bottomY + 36} m ${width - 60} ${bottomY + 36} l S\n`;

    stream += 'BT\n';
    stream += '/F2 11 Tf\n';
    stream += '0.15 0.2 0.25 rg\n';
    stream += `${rightX} ${bottomY + 22} Td\n`;
    stream += `(${this.escapePdfString(context.instructorName)}) Tj\n`;
    stream += 'ET\n';

    stream += 'BT\n';
    stream += '/F1 9 Tf\n';
    stream += '0.45 0.5 0.55 rg\n';
    stream += `${rightX} ${bottomY + 10} Td\n`;
    stream += `(Academic Instructor & Evaluator) Tj\n`;
    stream += 'ET\n';

    // Center: Vector QR Code and Certificate ID
    const qrSize = 64;
    const qrX = (width - qrSize) / 2;
    const qrY = bottomY - 10;
    stream += this.generateQrCodeCommands(verifyLink, qrX, qrY, qrSize);

    // Text under QR Code
    stream += 'BT\n';
    stream += '/F1 8 Tf\n';
    stream += '0.3 0.35 0.4 rg\n';
    const certIdLabel = `ID: ${context.certificateId}`;
    const certIdWidth = this.estimateTextWidth(certIdLabel, 8, false);
    stream += `${((width - certIdWidth) / 2).toFixed(2)} ${bottomY - 22} Td\n`;
    stream += `(${this.escapePdfString(certIdLabel)}) Tj\n`;
    stream += 'ET\n';

    stream += 'BT\n';
    stream += '/F1 7.5 Tf\n';
    stream += '0.45 0.5 0.55 rg\n';
    const verifyNote = `Issued: ${context.issueDate}  |  Scan to Verify Authenticity`;
    const noteWidth = this.estimateTextWidth(verifyNote, 7.5, false);
    stream += `${((width - noteWidth) / 2).toFixed(2)} ${bottomY - 32} Td\n`;
    stream += `(${this.escapePdfString(verifyNote)}) Tj\n`;
    stream += 'ET\n';

    // 5. Assemble final ISO-compliant PDF binary structure
    return this.buildPdfDocument(width, height, stream);
  }

  /**
   * Wrap long text into bounded lines for A4 portrait report layout.
   */
  wrapTextLines(text, maxChars = 88) {
    const clean = String(text || '')
      .replace(/[^\x20-\x7E\r\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return [];
    const words = clean.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      if (!current) {
        current = w.length > maxChars ? w.slice(0, maxChars) : w;
      } else if (current.length + 1 + w.length <= maxChars) {
        current += ` ${w}`;
      } else {
        lines.push(current);
        current = w.length > maxChars ? w.slice(0, maxChars) : w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /**
   * Generate an ISO 32000-1 (PDF 1.4) Individual Exam Performance Report PDF buffer
   * from an authoritative finalized exam report payload.
   */
  async generateExamReportPdf(report) {
    const { width, height } = this.PAGE_SIZES.A4;
    const marginX = 48;
    const contentWidth = width - marginX * 2;
    const topY = height - 48;
    const bottomY = 54;

    const meta = report?.meta || {};
    const student = report?.student || {};
    const outcome = report?.outcome || {};
    const counts = report?.counts || {};
    const feedback = report?.feedback || {};
    const topicBreakdown = Array.isArray(report?.topicBreakdown) ? report.topicBreakdown : [];
    const questionBreakdown = Array.isArray(report?.questionBreakdown) ? report.questionBreakdown : [];

    const pages = [];
    let stream = '';
    let y = topY;

    const drawPageChrome = (pageNum) => {
      let s = '';
      // Top header rule & banner
      s += '0.878 0.365 0.220 rg\n';
      s += `${marginX} ${height - 32} ${contentWidth} 3 re f\n`;
      if (pageNum === 1) {
        s += 'BT\n/F2 16 Tf\n0.12 0.16 0.22 rg\n';
        s += `${marginX} ${height - 56} Td\n(${this.escapePdfString('Unified Assessment Platform')}) Tj\nET\n`;
        s += 'BT\n/F1 10 Tf\n0.39 0.45 0.55 rg\n';
        s += `${marginX} ${height - 72} Td\n(${this.escapePdfString('Individual Exam Performance Report')}) Tj\nET\n`;
      } else {
        s += 'BT\n/F2 10 Tf\n0.39 0.45 0.55 rg\n';
        s += `${marginX} ${height - 52} Td\n(${this.escapePdfString(`${meta.examName || 'Exam'} - Performance Report (cont.)`)}) Tj\nET\n`;
      }
      return s;
    };

    const startPage = () => {
      const pageNum = pages.length + 1;
      stream = drawPageChrome(pageNum);
      y = pageNum === 1 ? height - 96 : height - 74;
    };

    const ensureSpace = (needed) => {
      if (y - needed < bottomY) {
        pages.push(stream);
        startPage();
      }
    };

    const writeText = (text, { font = 'F1', size = 10, x = marginX, color = '0.15 0.18 0.24', lineStep = 14 } = {}) => {
      ensureSpace(lineStep);
      stream += `BT\n/${font} ${size} Tf\n${color} rg\n${x} ${y} Td\n(${this.escapePdfString(text)}) Tj\nET\n`;
      y -= lineStep;
    };

    const drawSectionHeading = (title) => {
      ensureSpace(26);
      y -= 6;
      stream += '0.93 0.94 0.96 rg\n';
      stream += `${marginX} ${y - 4} ${contentWidth} 18 re f\n`;
      stream += `BT\n/F2 10.5 Tf\n0.12 0.16 0.22 rg\n${marginX + 6} ${y + 1} Td\n(${this.escapePdfString(title)}) Tj\nET\n`;
      y -= 20;
    };

    startPage();

    // Exam & Student Details
    drawSectionHeading('Examination & Candidate Summary');
    const examTypeDisplay = meta.examinationTag
      ? `${meta.examTypeLabel || 'Mock Test'} (${meta.examinationTag})`
      : (meta.examTypeLabel || 'Assessment');
    const dateText = meta.evaluatedAt
      ? new Date(meta.evaluatedAt).toISOString().split('T')[0]
      : (meta.submittedAt ? new Date(meta.submittedAt).toISOString().split('T')[0] : 'N/A');

    writeText(`Exam Name: ${meta.examName || 'Examination'}`, { font: 'F2', size: 10.5 });
    writeText(`Type: ${examTypeDisplay}   |   Subject: ${meta.subject || 'General'}   |   Evaluated Date: ${dateText}`, { size: 9.5, color: '0.35 0.42 0.52' });
    writeText(
      `Student: ${student.name || 'Student'}${student.studentId ? ` (ID: ${student.studentId})` : ''}${student.department ? `   |   Department: ${student.department}` : ''}`,
      { size: 9.5, color: '0.25 0.30 0.38' }
    );

    // Outcome Summary
    drawSectionHeading('Final Evaluation Outcome');
    const resultColor = outcome.passed ? '0.06 0.50 0.32' : '0.75 0.15 0.20';
    writeText(
      `Result: ${outcome.resultLabel || (outcome.passed ? 'Passed' : 'Failed')}   |   Evaluation Status: ${outcome.evaluationStatus || meta.evaluationStatus || 'Evaluated'}   |   Score: ${outcome.score ?? 0} / ${outcome.totalMarks ?? 0}   |   Percentage: ${outcome.percentage ?? 0}%   |   Threshold: ${outcome.passingThreshold ?? 60}%`,
      { font: 'F2', size: 9.5, color: resultColor }
    );
    if (outcome.grade) {
      writeText(
        `Grade: ${outcome.grade}${outcome.gradeLabel ? ` (${outcome.gradeLabel})` : ''}`,
        { font: 'F2', size: 9.5, color: '0.25 0.30 0.38' }
      );
    }
    if (report?.certification?.enabled) {
      const certLine = report.certification.issued
        ? `Certificate Status: Issued (${report.certification.certificateId})`
        : report.certification.eligible
          ? 'Certificate Status: Eligible'
          : 'Certificate Status: Not Eligible';
      writeText(certLine, { size: 9.5, color: '0.25 0.30 0.38' });
    }
    writeText(
      `Answer Breakdown: Correct ${counts.correct ?? 0}   |   Incorrect ${counts.incorrect ?? 0}   |   Unanswered ${counts.unanswered ?? 0}   |   Total Questions ${counts.totalQuestions ?? questionBreakdown.length}`,
      { size: 9.5, color: '0.35 0.42 0.52' }
    );

    // Faculty Feedback
    if (feedback.generalFeedback || feedback.outcomeFeedback || feedback.evaluatorName) {
      drawSectionHeading('Faculty Feedback & Remarks');
      if (feedback.evaluatorName) {
        writeText(`Evaluated By: ${feedback.evaluatorName}`, { font: 'F2', size: 9.5 });
      }
      if (feedback.generalFeedback) {
        for (const line of this.wrapTextLines(feedback.generalFeedback, 90)) {
          writeText(line, { size: 9.5, lineStep: 13 });
        }
      }
      if (feedback.outcomeFeedback) {
        for (const line of this.wrapTextLines(feedback.outcomeFeedback, 90)) {
          writeText(line, { size: 9.5, color: '0.35 0.42 0.52', lineStep: 13 });
        }
      }
    }

    // Topic-Wise Breakdown (only when real topic data exists)
    if (topicBreakdown.length > 0) {
      drawSectionHeading('Topic-Wise Performance');
      for (const topic of topicBreakdown) {
        writeText(
          `- ${topic.topicName}: ${topic.correctCount}/${topic.totalQuestions} correct (${topic.accuracyPercentage}%)`,
          { size: 9.5, lineStep: 13 }
        );
      }
    }

    // Question-Wise Performance
    if (questionBreakdown.length > 0) {
      drawSectionHeading('Question-Wise Performance');
      for (const q of questionBreakdown) {
        const headerLine = `Q${q.questionNumber} [${String(q.status || '').toUpperCase()}] ${q.marksAwarded}/${q.maxMarks} marks (${q.questionType || 'Question'})`;
        writeText(headerLine, { font: 'F2', size: 9.5, lineStep: 13 });
        const promptLines = this.wrapTextLines(q.prompt || '', 88).slice(0, 3);
        for (const line of promptLines) {
          writeText(line, { x: marginX + 10, size: 9, color: '0.30 0.35 0.42', lineStep: 12 });
        }
        if (q.codingDetails && q.codingDetails.executionResult) {
          const er = q.codingDetails.executionResult;
          const summary = `Code/SQL (${q.codingDetails.language || 'runtime'}): Verdict=${er.verdict || 'N/A'}${
            typeof er.passedCount === 'number' && typeof er.totalCount === 'number'
              ? `, Test Cases=${er.passedCount}/${er.totalCount}`
              : ''
          }`;
          writeText(summary, { x: marginX + 10, size: 8.5, color: '0.25 0.35 0.48', lineStep: 12 });
        }
        if (q.feedback) {
          for (const line of this.wrapTextLines(`Remark: ${q.feedback}`, 86)) {
            writeText(line, { x: marginX + 10, size: 8.5, color: '0.45 0.30 0.12', lineStep: 12 });
          }
        }
        y -= 3;
      }
    }

    // AI Integration Disclaimer
    drawSectionHeading('Performance Analysis (Integration Status)');
    for (const line of this.wrapTextLines(
      report?.Predictor?.disclaimer ||
        'Performance Analysis is not yet operational. Official scores and pass/fail outcomes are determined solely by faculty and automated evaluation.',
      90
    )) {
      writeText(line, { size: 8.5, color: '0.40 0.45 0.52', lineStep: 12 });
    }

    pages.push(stream);
    return this.buildMultiPagePdfDocument(width, height, pages);
  }

  /**
   * Constructs a multi-page PDF 1.4 document from an array of page content streams.
   */
  buildMultiPagePdfDocument(width, height, pageStreams) {
    const pages = Array.isArray(pageStreams) && pageStreams.length > 0 ? pageStreams : [''];
    const objects = [];
    const totalPages = pages.length;

    // 1: Catalog, 2: Pages, 3..3+N-1: Page objects, next N: Stream objects, last 3: Fonts
    const firstPageObjNum = 3;
    const firstStreamObjNum = firstPageObjNum + totalPages;
    const fontF1Num = firstStreamObjNum + totalPages;
    const fontF2Num = fontF1Num + 1;
    const fontF3Num = fontF1Num + 2;

    const kidsRefs = [];
    for (let i = 0; i < totalPages; i++) {
      kidsRefs.push(`${firstPageObjNum + i} 0 R`);
    }

    objects.push({
      num: 1,
      body: `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    });
    objects.push({
      num: 2,
      body: `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${totalPages} >>\nendobj\n`,
    });

    for (let i = 0; i < totalPages; i++) {
      const pageObjNum = firstPageObjNum + i;
      const streamObjNum = firstStreamObjNum + i;
      objects.push({
        num: pageObjNum,
        body: `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${fontF1Num} 0 R /F2 ${fontF2Num} 0 R /F3 ${fontF3Num} 0 R >> >> >>\nendobj\n`,
      });
    }

    for (let i = 0; i < totalPages; i++) {
      const streamObjNum = firstStreamObjNum + i;
      const footer = `\nBT\n/F1 8 Tf\n0.5 0.55 0.6 rg\n48 28 Td\n(${this.escapePdfString(`Unified Assessment Platform  |  Page ${i + 1} of ${totalPages}`)}) Tj\nET\n`;
      const fullStream = `${pages[i]}${footer}`;
      const streamLength = Buffer.byteLength(fullStream, 'utf-8');
      objects.push({
        num: streamObjNum,
        body: `${streamObjNum} 0 obj\n<< /Length ${streamLength} >>\nstream\n${fullStream}\nendstream\nendobj\n`,
      });
    }

    objects.push({
      num: fontF1Num,
      body: `${fontF1Num} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
    });
    objects.push({
      num: fontF2Num,
      body: `${fontF2Num} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
    });
    objects.push({
      num: fontF3Num,
      body: `${fontF3Num} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj\n`,
    });

    const pdfHeader = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    let offset = Buffer.byteLength(pdfHeader, 'utf-8');
    const xrefOffsets = [];
    let pdfBody = '';

    for (const obj of objects) {
      xrefOffsets[obj.num] = offset;
      pdfBody += obj.body;
      offset += Buffer.byteLength(obj.body, 'utf-8');
    }

    const startXref = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      const pos = String(xrefOffsets[i]).padStart(10, '0');
      xref += `${pos} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.concat([
      Buffer.from(pdfHeader, 'utf-8'),
      Buffer.from(pdfBody, 'utf-8'),
      Buffer.from(xref, 'utf-8'),
      Buffer.from(trailer, 'utf-8'),
    ]);
  }

  /**
   * Constructs the complete PDF 1.4 document including cross-reference table and trailer.
   */
  buildPdfDocument(width, height, contentStream) {
    const streamBuffer = Buffer.from(contentStream, 'utf-8');
    const streamLength = streamBuffer.length;

    // Standard PDF Objects:
    // 1: Catalog
    // 2: Pages
    // 3: Page
    // 4: Content Stream
    // 5: Font F1 (Helvetica)
    // 6: Font F2 (Helvetica-Bold)
    // 7: Font F3 (Times-Italic / Helvetica-Oblique)

    const objects = [];

    // Object 1: Catalog
    objects.push({
      num: 1,
      body: `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    });

    // Object 2: Pages
    objects.push({
      num: 2,
      body: `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    });

    // Object 3: Page
    objects.push({
      num: 3,
      body: `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj\n`,
    });

    // Object 4: Contents Stream
    objects.push({
      num: 4,
      body: `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    });

    // Object 5: Standard Font Helvetica
    objects.push({
      num: 5,
      body: `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
    });

    // Object 6: Standard Font Helvetica-Bold
    objects.push({
      num: 6,
      body: `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
    });

    // Object 7: Standard Font Helvetica-Oblique
    objects.push({
      num: 7,
      body: `7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj\n`,
    });

    // Assemble PDF file with cross-reference table
    let pdfHeader = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    let offset = Buffer.byteLength(pdfHeader, 'utf-8');
    const xrefOffsets = [];

    let pdfBody = '';
    for (const obj of objects) {
      xrefOffsets[obj.num] = offset;
      pdfBody += obj.body;
      offset += Buffer.byteLength(obj.body, 'utf-8');
    }

    const startXref = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      const pos = String(xrefOffsets[i]).padStart(10, '0');
      xref += `${pos} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.concat([
      Buffer.from(pdfHeader, 'utf-8'),
      Buffer.from(pdfBody, 'utf-8'),
      Buffer.from(xref, 'utf-8'),
      Buffer.from(trailer, 'utf-8'),
    ]);
  }
}

module.exports = new PdfGenerator();
