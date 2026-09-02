-- Register Improvements and Corrections Control under Applications
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Improvements-and-Corrections-Control.html', 'Applications_Improvements_Corrections'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications
  WHERE syap_nm_application = 'Improvements-and-Corrections-Control.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Improvements_Corrections'
WHERE syap_nm_application = 'Improvements-and-Corrections-Control.html';

CREATE SEQUENCE IF NOT EXISTS improvements_corrections_request_number_seq;

CREATE TABLE IF NOT EXISTS improvements_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number BIGINT UNIQUE NOT NULL DEFAULT nextval('improvements_corrections_request_number_seq'),
  description TEXT NOT NULL,
  request_type VARCHAR(30) NOT NULL,
  application_name VARCHAR(100),
  application_menu VARCHAR(150),
  situation VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
  request_date DATE,
  finish_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  created_by_name VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT improvements_corrections_type_chk
    CHECK (request_type IN ('IMPROVEMENT', 'CORRECTION', 'NEW_FUNCTIONALITY')),
  CONSTRAINT improvements_corrections_situation_chk
    CHECK (situation IN ('NOT_STARTED', 'IN_DEVELOPMENT', 'IN_TESTING', 'IN_CLIENT_VALIDATION', 'APPROVED', 'NOT_APPROVED', 'LIVE', 'CANCELLED'))
);

ALTER TABLE improvements_corrections ADD COLUMN IF NOT EXISTS request_number BIGINT;
ALTER TABLE improvements_corrections ALTER COLUMN request_number SET DEFAULT nextval('improvements_corrections_request_number_seq');
UPDATE improvements_corrections SET request_number = nextval('improvements_corrections_request_number_seq') WHERE request_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_improvements_corrections_request_number ON improvements_corrections(request_number);

CREATE INDEX IF NOT EXISTS idx_improvements_corrections_criado ON improvements_corrections(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_improvements_corrections_type ON improvements_corrections(request_type);
