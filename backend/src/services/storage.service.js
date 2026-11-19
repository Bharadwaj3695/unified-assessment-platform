const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StorageService {
  constructor() {
    // Dedicated private folder outside public static routes
    this.documentsDir = path.resolve(__dirname, '../../storage/documents');
    this.ensureDirectoryExists(this.documentsDir);

    // Dedicated secure private folder for immutable certificate PDF credentials
    this.certificatesDir = path.resolve(__dirname, '../../storage/certificates');
    this.ensureDirectoryExists(this.certificatesDir);
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Validate and sanitize file extension.
   * Only pdf, doc, docx are allowed for document submissions.
   */
  validateExtension(filename, allowedExtensions = ['pdf', 'doc', 'docx']) {
    const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
    const dangerousExtensions = /^(exe|sh|bat|cmd|php|js|mjs|py|pl|cgi|jar|war|dll|so|html|htm|svg|xml|vbs|ps1)$/i;
    
    if (dangerousExtensions.test(ext)) {
      const err = new Error('Executable and script files are strictly forbidden');
      err.statusCode = 400;
      throw err;
    }

    const normalizedAllowed = allowedExtensions.map((e) => e.toLowerCase().replace(/^\./, ''));
    if (!normalizedAllowed.includes(ext)) {
      const err = new Error(`Invalid file type. Allowed formats: ${normalizedAllowed.join(', ').toUpperCase()}`);
      err.statusCode = 400;
      throw err;
    }

    return ext;
  }

  /**
   * Validate MIME type against allowed document mimetypes.
   */
  validateMimeType(mimetype, ext) {
    const validMimes = {
      pdf: ['application/pdf'],
      doc: ['application/msword', 'application/x-msword'],
      docx: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream',
      ],
    };

    const expectedMimes = validMimes[ext] || [];
    if (!expectedMimes.includes(mimetype.toLowerCase())) {
      const err = new Error(`Invalid MIME type (${mimetype}) for document format .${ext}`);
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Save an uploaded document buffer to disk using a cryptographically random, collision-safe key.
   */
  async saveDocumentFile({ buffer, originalname, mimetype, size, submissionId, questionId, allowedExtensions }) {
    const ext = this.validateExtension(originalname, allowedExtensions);
    this.validateMimeType(mimetype, ext);

    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const safeKey = `doc-${submissionId}-${questionId}-${Date.now()}-${randomSuffix}.${ext}`;
    const targetPath = path.join(this.documentsDir, safeKey);

    await fs.promises.writeFile(targetPath, buffer);

    // Sanitize original filename (prevent path traversal or header injection)
    const sanitizedOriginal = path.basename(originalname).replace(/[\r\n\0]/g, '');

    return {
      type: 'file',
      fileKey: safeKey,
      originalFilename: sanitizedOriginal,
      mimeType: mimetype,
      size,
      uploadedAt: new Date(),
    };
  }

  /**
   * Resolve safe file path and ensure it remains strictly inside the storage directory.
   */
  getDocumentFilePath(fileKey) {
    if (!fileKey || typeof fileKey !== 'string') {
      const err = new Error('Invalid file identifier');
      err.statusCode = 400;
      throw err;
    }

    // Sanitize to prevent path traversal (e.g., ../../etc/passwd)
    const safeKey = path.basename(fileKey);
    const resolvedPath = path.resolve(this.documentsDir, safeKey);

    // Check path traversal boundary
    if (!resolvedPath.startsWith(this.documentsDir)) {
      const err = new Error('Access denied. Invalid storage path traversal.');
      err.statusCode = 403;
      throw err;
    }

    if (!fs.existsSync(resolvedPath)) {
      const err = new Error('The requested document could not be found on storage.');
      err.statusCode = 404;
      throw err;
    }

    return resolvedPath;
  }

  /**
   * Save an issued certificate PDF buffer to dedicated secure storage.
   */
  async saveCertificatePdf({ certificateId, buffer }) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      const err = new Error('Valid PDF buffer is required for certificate storage');
      err.statusCode = 400;
      throw err;
    }

    const sanitizedId = String(certificateId || 'cert')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const safeKey = `cert-${sanitizedId}-${Date.now()}-${randomSuffix}.pdf`;
    const targetPath = path.join(this.certificatesDir, safeKey);

    await fs.promises.writeFile(targetPath, buffer);

    return {
      fileKey: safeKey,
      filePath: targetPath,
      fileSize: buffer.length,
      generatedAt: new Date(),
    };
  }

  /**
   * Resolve safe certificate PDF file path and ensure it strictly resides within certificates directory.
   */
  getCertificateFilePath(fileKey) {
    if (!fileKey || typeof fileKey !== 'string') {
      const err = new Error('Invalid certificate file identifier');
      err.statusCode = 400;
      throw err;
    }

    const safeKey = path.basename(fileKey);
    const resolvedPath = path.resolve(this.certificatesDir, safeKey);

    if (!resolvedPath.startsWith(this.certificatesDir)) {
      const err = new Error('Access denied. Path traversal detected.');
      err.statusCode = 403;
      throw err;
    }

    if (!fs.existsSync(resolvedPath)) {
      const err = new Error('The requested certificate file could not be found in storage.');
      err.statusCode = 404;
      throw err;
    }

    return resolvedPath;
  }

  /**
   * Retrieve certificate PDF file buffer directly from storage.
   */
  async getCertificatePdfBuffer(fileKey) {
    const filePath = this.getCertificateFilePath(fileKey);
    return await fs.promises.readFile(filePath);
  }

  /**
   * Delete a certificate PDF file safely from storage.
   */
  async deleteCertificateFile(fileKey) {
    if (!fileKey || typeof fileKey !== 'string') return;
    try {
      const safeKey = path.basename(fileKey);
      const filePath = path.resolve(this.certificatesDir, safeKey);
      if (filePath.startsWith(this.certificatesDir) && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn('[StorageService] Non-fatal error deleting certificate PDF file:', err.message);
    }
  }

  /**
   * Delete a document from storage safely.
   */
  async deleteDocumentFile(fileKey) {
    if (!fileKey || typeof fileKey !== 'string') return;
    try {
      const safeKey = path.basename(fileKey);
      const filePath = path.resolve(this.documentsDir, safeKey);
      if (filePath.startsWith(this.documentsDir) && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn('[StorageService] Non-fatal error deleting document file:', err.message);
    }
  }

  /**
   * Validate Google Docs URL.
   * Strictly validates HTTPS, docs.google.com hostname, and document path.
   * NEVER fetches the URL server-side to prevent SSRF.
   */
  validateGoogleDocsUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) {
      const err = new Error('Google Docs URL is required');
      err.statusCode = 400;
      throw err;
    }

    const trimmed = urlStr.trim();

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (e) {
      const err = new Error('Invalid URL format. Please provide a complete Google Docs URL.');
      err.statusCode = 400;
      throw err;
    }

    // Protocol must be HTTPS
    if (parsed.protocol !== 'https:') {
      const err = new Error('Google Docs URL must use secure HTTPS protocol');
      err.statusCode = 400;
      throw err;
    }

    // Hostname must be strictly docs.google.com
    if (parsed.hostname.toLowerCase() !== 'docs.google.com') {
      const err = new Error('URL must belong to the docs.google.com domain');
      err.statusCode = 400;
      throw err;
    }

    // Must not contain embedded user credentials
    if (parsed.username || parsed.password) {
      const err = new Error('URLs with embedded credentials are not permitted');
      err.statusCode = 400;
      throw err;
    }

    // Path must follow standard Google Docs pattern: /document/d/<documentId>...
    const docPathPattern = /^\/document\/d\/[a-zA-Z0-9_-]+/i;
    if (!docPathPattern.test(parsed.pathname)) {
      const err = new Error(
        'Invalid Google Docs link format. URL must match standard document pattern (https://docs.google.com/document/d/...)'
      );
      err.statusCode = 400;
      throw err;
    }

    return {
      type: 'google_docs',
      googleDocsUrl: parsed.toString(),
      submittedAt: new Date(),
    };
  }
}

module.exports = new StorageService();
