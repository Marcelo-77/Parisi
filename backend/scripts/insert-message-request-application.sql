-- Register Message Request applications under Applications menu
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Message-Request.html', 'Applications_Message_Request'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'Message-Request.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Message_Request'
WHERE syap_nm_application = 'Message-Request.html';

INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Search-Message-Request.html', 'Applications_Message_Request_Search'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'Search-Message-Request.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Message_Request_Search'
WHERE syap_nm_application = 'Search-Message-Request.html';

CREATE SEQUENCE IF NOT EXISTS message_requests_request_number_seq;

CREATE TABLE IF NOT EXISTS message_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number BIGINT UNIQUE NOT NULL DEFAULT nextval('message_requests_request_number_seq'),
  message_type VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
  recipient_name VARCHAR(150),
  recipient_email VARCHAR(255),
  subject VARCHAR(255) NOT NULL,
  message_content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  desired_date DATE,
  attachment_note VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  assigned_to UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  assigned_to_name VARCHAR(100),
  rejection_reason TEXT,
  final_subject VARCHAR(255),
  final_content TEXT,
  request_history TEXT,
  created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  created_by_name VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_requests_type_chk
    CHECK (message_type IN ('EMAIL', 'INTERNAL', 'SMS')),
  CONSTRAINT message_requests_priority_chk
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT message_requests_status_chk
    CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'))
);

CREATE INDEX IF NOT EXISTS idx_message_requests_criado ON message_requests(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_message_requests_status ON message_requests(status);
CREATE INDEX IF NOT EXISTS idx_message_requests_number ON message_requests(request_number);
