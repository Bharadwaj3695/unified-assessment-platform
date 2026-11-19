const qrcode = require('qrcode');

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

    // Formatting date
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

    // Placeholders context
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
