-- Register Message Email applications under Applications menu
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Message-Email.html', 'Applications_Message_Email'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'Message-Email.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Message_Email'
WHERE syap_nm_application = 'Message-Email.html';

INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Search-Message-Email.html', 'Applications_Message_Email_Search'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'Search-Message-Email.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Message_Email_Search'
WHERE syap_nm_application = 'Search-Message-Email.html';

CREATE TABLE IF NOT EXISTS message_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_code VARCHAR(50) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  created_by_name VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_emails_status_chk
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT message_emails_category_chk
    CHECK (category IN ('GENERAL', 'WAREHOUSE', 'NOTIFICATION', 'WELCOME', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_message_emails_criado ON message_emails(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_message_emails_code ON message_emails(message_code);
CREATE INDEX IF NOT EXISTS idx_message_emails_status ON message_emails(status);
