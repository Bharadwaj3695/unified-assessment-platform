const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|py|pl|cgi|jar|war|dll|so)$/i;
  if (dangerousExtensions.test(ext)) {
    const err = new Error('Executable files are strictly forbidden');
    err.statusCode = 400;
    return cb(err);
  }

  const allowedExtensions = /^\.(jpe?g|png|webp|pdf|docx?|zip)$/i;
  const allowedMimetypes = /^(image\/(jpeg|png|webp)|application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/i;

  if (allowedExtensions.test(ext) || allowedMimetypes.test(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error('Only image and document files (JPEG, PNG, WEBP, PDF, DOC, DOCX, ZIP) are allowed');
  err.statusCode = 400;
  cb(err);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter,
});

const avatarFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = /^\.(jpe?g|png|webp)$/i;
  const allowedMimetypes = /^image\/(jpeg|png|webp)$/i;

  // Block dangerous executable extensions explicitly
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|py|pl|cgi|jar|war)$/i;
  if (dangerousExtensions.test(ext)) {
    const err = new Error('Executable files are strictly forbidden');
    err.statusCode = 400;
    return cb(err);
  }

  if (allowedExtensions.test(ext) && allowedMimetypes.test(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error('Only image files (JPEG, PNG, WEBP) are permitted for profile pictures');
  err.statusCode = 400;
  return cb(err);
};

const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for avatars
  fileFilter: avatarFileFilter,
});

const documentFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|mjs|py|pl|cgi|jar|war|dll|so|html|htm|svg|xml|vbs|ps1)$/i;
  if (dangerousExtensions.test(ext)) {
    const err = new Error('Executable and script files are strictly forbidden');
    err.statusCode = 400;
    return cb(err);
  }

  const allowedExtensions = /^\.(pdf|docx?)$/i;
  const allowedMimetypes = /^(application\/(pdf|msword|x-msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|zip|octet-stream))$/i;

  if (allowedExtensions.test(ext) && allowedMimetypes.test(file.mimetype)) {
    return cb(null, true);
  }

  const err = new Error('Only document files (PDF, DOC, DOCX) are allowed');
  err.statusCode = 400;
  return cb(err);
};

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB default limit
  fileFilter: documentFileFilter,
});

module.exports = upload;
module.exports.upload = upload;
module.exports.avatarUpload = avatarUpload;
module.exports.documentUpload = documentUpload;
