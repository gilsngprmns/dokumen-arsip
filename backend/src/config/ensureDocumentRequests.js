const pool = require("./database");

async function ensureDocumentRequests() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_requests (
      id SERIAL PRIMARY KEY,
      requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      requester_seksi_id INTEGER NOT NULL REFERENCES seksi(id) ON DELETE RESTRICT,
      target_seksi_id INTEGER NOT NULL REFERENCES seksi(id) ON DELETE RESTRICT,
      judul_permintaan VARCHAR(255) NOT NULL,
      detail_permintaan TEXT,
      dokumen_id INTEGER REFERENCES dokumen(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'requested',
      processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      response_note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT document_requests_status_check CHECK (status IN ('requested', 'processed', 'completed')),
      CONSTRAINT document_requests_sections_check CHECK (requester_seksi_id <> target_seksi_id)
    );

    ALTER TABLE log_aktivitas
      ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES document_requests(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS document_requests_requested_by_idx ON document_requests(requested_by);
    CREATE INDEX IF NOT EXISTS document_requests_target_seksi_idx ON document_requests(target_seksi_id);
    CREATE INDEX IF NOT EXISTS document_requests_status_idx ON document_requests(status);
    CREATE INDEX IF NOT EXISTS document_requests_created_at_idx ON document_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS log_aktivitas_request_id_idx ON log_aktivitas(request_id);
  `);
}

module.exports = ensureDocumentRequests;
