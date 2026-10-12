const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.resolve(__dirname, "../../uploads");

// Pastikan folder upload tersedia sebelum multer menulis file.
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Peta ekstensi -> MIME yang diizinkan. Memvalidasi KEDUANYA (ekstensi dan
// mimetype) mencegah manipulasi tipe file (mis. file berbahaya yang hanya
// di-rename menjadi .pdf).
const allowedMimeTypes = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMimes = allowedMimeTypes[extension];

    if (!expectedMimes) {
      return callback(new Error("Tipe file tidak didukung"));
    }

    if (!expectedMimes.includes(file.mimetype)) {
      return callback(new Error("Isi file tidak sesuai dengan ekstensi file"));
    }

    return callback(null, true);
  },
});

const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran file maksimal 10 MB"
          : error.message,
    });
  });
};

module.exports = { handleUpload, uploadDirectory };