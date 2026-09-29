require("dotenv").config();

const fs = require("fs");
const path = require("path");

const sourceDirectory = path.resolve(__dirname, "../uploads");
const backupRoot = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "../backups"));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destinationDirectory = path.join(backupRoot, `uploads-${timestamp}`);

fs.mkdirSync(destinationDirectory, { recursive: true });

if (!fs.existsSync(sourceDirectory)) {
  console.log("Upload directory belum ada; backup kosong dibuat.");
  process.exit(0);
}

fs.cpSync(sourceDirectory, destinationDirectory, { recursive: true, errorOnExist: false });
console.log(`Upload backup created: ${destinationDirectory}`);
