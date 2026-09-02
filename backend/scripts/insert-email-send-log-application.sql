-- Email send log table + Search Email Send Log application registration
-- Run in Neon SQL Editor or: node scripts/run-insert-email-send-log-app.js

CREATE TABLE IF NOT EXISTS email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_code VARCHAR(50),
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255),
  to_name VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  body_preview TEXT,
  send_status VARCHAR(20) NOT NULL DEFAULT 'FAILED',
  error_message TEXT,
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number BIGINT,
  sent_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  sent_by_name VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT email_send_logs_status_chk
    CHECK (send_status IN ('SENT', 'FAILED', 'SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_criado ON email_send_logs(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON email_send_logs(send_status);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_reference ON email_send_logs(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_to_email ON email_send_logs(to_email);

INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Search-Email-Send-Log.html', 'Applications_Message_Email_Send_Log'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'Search-Email-Send-Log.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Message_Email_Send_Log'
WHERE syap_nm_application = 'Search-Email-Send-Log.html';

-- Optional default APPROVAL template (customize in Message Email screen)
INSERT INTO message_emails (message_code, subject, body, category, status, notes, created_by_name)
SELECT
  'APPROVAL',
  'Approval required: Request #{{requestNumber}}',
  'Hello {{requesterName}},\n\nA request is waiting for your approval validation.\n\nRequest #: {{requestNumber}}\nType: {{requestType}}\nApplication / functionality: {{functionality}}\nDescription: {{description}}\n\nPlease review the request in Improvements and Corrections Search.\n\nDouble-Y IT Systems',
  'NOTIFICATION',
  'ACTIVE',
  'Default approval email template for Improvements and Corrections',
  'System'
WHERE NOT EXISTS (
  SELECT 1 FROM message_emails WHERE TRIM(UPPER(message_code)) = 'APPROVAL'
);
