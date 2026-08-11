-- Register Test Case under Applications > Test Control
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Test-Case.html', 'Applications_Test_Control'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications
  WHERE syap_nm_application = 'Test-Case.html'
);

INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Test-Case-Search.html', 'Applications_Test_Control_Search'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications
  WHERE syap_nm_application = 'Test-Case-Search.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Test_Control'
WHERE syap_nm_application = 'Test-Case.html';

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Test_Control_Search'
WHERE syap_nm_application = 'Test-Case-Search.html';

CREATE SEQUENCE IF NOT EXISTS test_case_number_seq;

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_number INTEGER UNIQUE NOT NULL DEFAULT nextval('test_case_number_seq'),
  test_case_id VARCHAR(20) UNIQUE NOT NULL,
  module VARCHAR(50) NOT NULL,
  test_scenario TEXT NOT NULL,
  pre_condition TEXT,
  test_steps TEXT,
  expected_result TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Not Executed',
  severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
  tester VARCHAR(100),
  execution_date DATE,
  comments TEXT,
  evidence_file_name VARCHAR(200),
  evidence_mime_type VARCHAR(100),
  evidence_file_size INTEGER,
  evidence_file_data BYTEA,
  created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  created_by_name VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT test_cases_module_chk CHECK (module IN (
    'Sales Order', 'Mobile Warehouse', 'Picking', 'Validation Code', 'Integration', 'PDA - Test'
  )),
  CONSTRAINT test_cases_status_chk CHECK (status IN (
    'Not Executed', 'Pass', 'Fail', 'Blocked', 'In Progress'
  )),
  CONSTRAINT test_cases_severity_chk CHECK (severity IN (
    'Critical', 'High', 'Medium', 'Low'
  ))
);

CREATE INDEX IF NOT EXISTS idx_test_cases_module ON test_cases(module);
CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_test_cases_id ON test_cases(test_case_id);
