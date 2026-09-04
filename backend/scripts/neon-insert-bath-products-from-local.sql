-- =============================================================================
-- Double-Y Warehouse System - BATH products from LOCAL DB for Neon Approval
-- Gerado em: 2026-09-04T06:31:21.298Z
-- Origem: DB_HOST=localhost / DB_NAME=funcionarios_db
-- Total de produtos: 158
-- Com barcode: 135
-- Com supplier_product_code: 134
-- Categoria/grupo: BATH
-- Subgrupos:
--   AQUALINE: 1
--   ATLAS: 1
--   ATOMIC: 1
--   BLADE: 8
--   CURVA: 1
--   ELLI: 12
--   ELLISSE: 18
--   ENVY: 13
--   FLOAT: 6
--   HERMITAGE: 8
--   LHOTEL: 4
--   LINFA: 36
--   LOFT: 2
--   LOOM: 6
--   NATURALE: 1
--   NETTUNO: 2
--   OVALE: 4
--   OVATION: 8
--   QTS: 1
--   QUADRO: 10
--   QUASAR: 7
--   ROTONDO: 2
--   SATURNIA: 1
--   SOAK: 4
--   SOTTOVALE: 1
--
-- Como usar no Neon SQL Editor (Approval):
--   1) Cole este arquivo completo e clique Run
--   2) Verifique os totais no final do script
-- =============================================================================

BEGIN;

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS barcode NUMERIC(20);

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(50);

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS supplier_product_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_subcategoria
  ON warehouse_items(subcategoria);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_supplier_product_code
  ON warehouse_items(supplier_product_code);

INSERT INTO warehouse_items (
  codigo, barcode, nome, categoria, subcategoria, supplier_product_code,
  quantidade, quantidade_minima, preco_unitario
)
VALUES
  ('AB15070.B', NULL, 'Blade Bath 1500x700x415mm (with Feet)', 'BATH', 'BLADE', NULL, 0, 0, 0),
  ('AB15075.E', 9340379150021, 'L''Hotel Bath 1500x750x370mm (with Feet)', 'BATH', 'LHOTEL', 'BSA1575', 0, 0, 0),
  ('AB16070.C', 9340379061778, 'Quasar Bath 1600x700x415mm (with Feet)', 'BATH', 'QUASAR', 'BSA1602', 0, 0, 0),
  ('AB16070.E', 9340379041084, 'L''Hotel Bath 1600x700x370mm (with Feet)', 'BATH', 'LHOTEL', 'BSA1604', 0, 0, 0),
  ('AB17070.C', 9340379043347, 'Quasar Bath 1700x700x415mm (with Feet)', 'BATH', 'QUASAR', NULL, 0, 0, 0),
  ('AB17070.E', 9340379041091, 'L''Hotel Bath 1700x700x370mm (with Feet)', 'BATH', 'LHOTEL', 'BSA1704', 0, 0, 0),
  ('AB17070.E-O', NULL, 'L''Hotel Bath Including Overflow & Waste Kit 1700x700x370mm (with Feet)', 'BATH', 'LHOTEL', 'BSA1704', 0, 0, 0),
  ('AB17075.A', 9340379104994, 'Aqualine Bath 1700x750x434mm (with Feet)', 'BATH', 'AQUALINE', NULL, 0, 0, 0),
  ('AB17075.B', 9340379036387, 'Blade Bath 1700x750x415mm (with Feet)', 'BATH', 'BLADE', 'BSA1771 - NO OVERFLOW', 0, 0, 0),
  ('AB17075.D', 9340379038183, 'Elli Bath 1700x750x415mm (with Feet)', 'BATH', 'ELLI', NULL, 0, 0, 0),
  ('ABF12860R-O', 9340379153251, 'Rotondo Freestanding Bath with Overflow (Including Waste) 1280x600mm', 'BATH', 'ROTONDO', 'ROT-1280-O', 0, 0, 0),
  ('ABF12860R-OM', 9340379153268, 'Rotondo Freestanding Bath with Overflow (Including Waste) 1280x600mm Matt White', 'BATH', 'ROTONDO', 'ROT-1280-OM', 0, 0, 0),
  ('ABF13080S-MO', 9340379153404, 'Soak Freestanding Bath with Overflow 1300x800x795mm Matt White (Including Matt White Step)', 'BATH', 'SOAK', 'FUJI-1300-MW WITH OVERFLOW+ MW STEP', 0, 0, 0),
  ('ABF13080S-O', 9340379153398, 'Soak Freestanding Bath with Overflow 1300x800x795mm (Including Gloss White Step)', 'BATH', 'SOAK', 'FUJI-1300 WITH OVERFLOW+ GLOSS STEP', 0, 0, 0),
  ('ABF14070BI', 9340379145577, 'Linfa Freestanding Bath (Back To Wall) 1400x700x585mm', 'BATH', 'LINFA', 'SCO 14070BTW', 0, 0, 0),
  ('ABF14070BI-M', 9340379145584, 'Linfa Freestanding Bath (Back to Wall) 1400x700x585mm Matt White', 'BATH', 'LINFA', 'SCO 14070BTW-M', 0, 0, 0),
  ('ABF14070BI-MO', 9340379145591, 'Linfa Freestanding Bath with Overflow (Back to Wall) 1400x700x585mm Matt White', 'BATH', 'LINFA', 'SCO 14070BTW-M WITH OVERFLOW', 0, 0, 0),
  ('ABF14070BI-O', 9340379145607, 'Linfa Freestanding Bath with Overflow (Back to Wall) 1400x700x585mm', 'BATH', 'LINFA', 'SCO 14070BTW WITH OVERFLOW', 0, 0, 0),
  ('ABF14070E', 9340379061785, 'Ellisse Freestanding Bath 1400x700x585mm', 'BATH', 'ELLISSE', 'DIV 14070', 0, 0, 0),
  ('ABF14070E-M', 9340379105014, 'Ellisse Freestanding Bath 1400x700x585mm Matt White', 'BATH', 'ELLISSE', 'DIV 14070 MW', 0, 0, 0),
  ('ABF14070E-MO', 9340379153275, 'Ellisse Freestanding Bath with Overflow 1400x700x585mm Matt White', 'BATH', 'ELLISSE', 'DIV 14070 MW & OVERFLOW', 0, 0, 0),
  ('ABF14070E-O', 9340379153282, 'Ellisse Freestanding Bath with Overflow 1400x700x585mm', 'BATH', 'ELLISSE', 'DIV 14070 & OVERFLOW', 0, 0, 0),
  ('ABF14070LI', 9340379145614, 'Linfa Freestanding Bath (Left Hand Corner) 1400x700x585mm', 'BATH', 'LINFA', 'SCO 14070LH', 0, 0, 0),
  ('ABF14070LI-M', 9340379145621, 'Linfa Freestanding Bath (Left Hand Corner) 1400x700x585mm Matt White', 'BATH', 'LINFA', 'SCO 14070LH-M', 0, 0, 0),
  ('ABF14070LI-MO', 9340379145638, 'Linfa Freestanding Bath with Overflow (Left Hand Corner) 1400x700x585mm Matt White', 'BATH', 'LINFA', 'SCO 14070LH-M WITH OVERFLOW', 0, 0, 0),
  ('ABF14070LI-O', 9340379145645, 'Linfa Freestanding Bath with Overflow (Left Hand Corner) 1400x700x585mm', 'BATH', 'LINFA', 'SCO 14070LH WITH OVERFLOW', 0, 0, 0),
  ('ABF14070Q2-MO', 9340379153299, 'Quadro II Freestanding Bath with Overflow 1400x700x585mm Matt White', 'BATH', 'QUADRO', 'STU 14070S MATT WHITE WITH OVERFLOW', 0, 0, 0),
  ('ABF14070Q2-O', 9340379153305, 'Quadro II Freestanding Bath with Overflow 1400x700x585mm', 'BATH', 'QUADRO', 'STU 14070S WITH OVERFLOW', 0, 0, 0),
  ('ABF14070RI', 9340379145652, 'Linfa Freestanding Bath (Right Hand Corner) 1400x700x585mm', 'BATH', 'LINFA', 'SCO 14070RH', 0, 0, 0),
  ('ABF14070RI-M', 9340379145669, 'Linfa Freestanding Bath (Right Hand Corner) 1400x700x585mm Matt White', 'BATH', 'LINFA', 'SCO 14070RH-M', 0, 0, 0),
  ('ABF14070RI-MO', 9340379145676, 'Linfa Freestanding Bath with Overflow (Right Hand Corner) 1400x700x585mm Matt White', 'BATH', 'LINFA', 'SCO 14070RH-M WITH OVERFLOW', 0, 0, 0),
  ('ABF14070RI-O', 9340379145683, 'Linfa Freestanding Bath with Overflow (Right Hand Corner) 1400x700x585mm', 'BATH', 'LINFA', 'SCO 14070RH WITH OVERFLOW', 0, 0, 0),
  ('ABF15070L', 9340379038190, 'Elli II Freestanding Bath 1500x700x600mm', 'BATH', 'ELLI', 'ELL 1570S', 0, 0, 0),
  ('ABF15070L-M', 9340379038206, 'Elli II Freestanding Bath 1500x700x600mm Matt White', 'BATH', 'ELLI', 'ELL 1570S MW', 0, 0, 0),
  ('ABF15070L-MO', 9340379147939, 'Elli II Freestanding Bath with Overflow 1500x700x600mm Matt White', 'BATH', 'ELLI', 'ELL 1570S MW & OVERFLOW', 0, 0, 0),
  ('ABF15070L-O', 9340379144600, 'Elli II Freestanding Bath with Overflow 1500x700x600mm', 'BATH', 'ELLI', 'ELL 1570S & OVERFLOW', 0, 0, 0),
  ('ABF15074H', 9340379033072, 'Hermitage Freestanding Bath 1500x740x600mm', 'BATH', 'HERMITAGE', 'NYK-1500', 0, 0, 0),
  ('ABF15074H-M', 9340379033089, 'Hermitage Freestanding Bath 1500x740x600mm Matt White', 'BATH', 'HERMITAGE', 'NYK-1500-M', 0, 0, 0),
  ('ABF15074H-O', NULL, 'Hermitage Freestanding Bath with Overflow 1500x740x600mm', 'BATH', 'HERMITAGE', 'NYK-1500- WITH OVERFLOW', 0, 0, 0),
  ('ABF15075B', 9340379048106, 'Blade Freestanding Bath (Back to Wall) 1500x750x585mm', 'BATH', 'BLADE', 'BAR-1500', 0, 0, 0),
  ('ABF15075B-M', 9340379048113, 'Blade Freestanding Bath (Back to Wall) 1500x750x585mm Matt White', 'BATH', 'BLADE', 'BAR-1500-M', 0, 0, 0),
  ('ABF15075B-O', 9340379153312, 'Blade Freestanding Bath with Overflow (Back to Wall) 1500x750x585mm', 'BATH', 'BLADE', 'BAR-1500- WITH OVERFLOW', 0, 0, 0),
  ('ABF15075BI', 9340379145690, 'Linfa Freestanding Bath (Back to Wall) 1500x750x585mm', 'BATH', 'LINFA', 'SCO 15075BTW', 0, 0, 0),
  ('ABF15075BI-M', 9340379145706, 'Linfa Freestanding Bath (Back to Wall) 1500x750x585mm Matt White', 'BATH', 'LINFA', 'SCO 15075BTW-M', 0, 0, 0),
  ('ABF15075BI-MO', 9340379145713, 'Linfa Freestanding Bath with Overflow (Back to Wall) 1500x750x585mm Matt White', 'BATH', 'LINFA', 'SCO 15075BTW-M WITH OVERFLOW', 0, 0, 0),
  ('ABF15075BI-O', 9340379145720, 'Linfa Freestanding Bath with Overflow (Back to Wall) 1500x750x585mm', 'BATH', 'LINFA', 'SCO 15075BTW WITH OVERFLOW', 0, 0, 0),
  ('ABF15075E', 9340379038862, 'Ellisse Freestanding Bath 1500x750x585mm', 'BATH', 'ELLISSE', 'PAC 15075S', 0, 0, 0),
  ('ABF15075E-M', NULL, 'Ellisse Freestanding Bath 1500x750x585mm Matt White', 'BATH', 'ELLISSE', 'PAC 15075S MW', 0, 0, 0),
  ('ABF15075E-MO', 9340379150632, 'Ellisse Freestanding Bath with Overflow 1500x750x585mm Matt White', 'BATH', 'ELLISSE', 'PAC 15075S MW & OVERFLOW', 0, 0, 0),
  ('ABF15075E-O', 9340379150625, 'Ellisse Freestanding Bath with Overflow 1500x750x585mm', 'BATH', 'ELLISSE', 'PAC 15075S & OVERFLOW', 0, 0, 0),
  ('ABF15075F', 9340379033119, 'Float Freestanding Bath 1500x750x585mm', 'BATH', 'FLOAT', 'MUN-1500', 0, 0, 0),
  ('ABF15075F-M', 9340379033126, 'Float Freestanding Bath 1500x750x585mm Matt White', 'BATH', 'FLOAT', 'MUN-1500-M', 0, 0, 0),
  ('ABF15075LI', 9340379145737, 'Linfa Freestanding Bath (Left Hand Corner) 1500x750x585mm', 'BATH', 'LINFA', 'SCO 15075LH', 0, 0, 0),
  ('ABF15075LI-M', 9340379145744, 'Linfa Freestanding Bath (Left Hand Corner) 1500x750x585mm Matt White', 'BATH', 'LINFA', 'SCO 15075LH-M', 0, 0, 0),
  ('ABF15075LI-MO', 9340379145751, 'Linfa Freestanding Bath with Overflow (Left Hand Corner) 1500x750x585mm Matt White', 'BATH', 'LINFA', 'SCO 15075LH-M WITH OVERFLOW', 0, 0, 0),
  ('ABF15075LI-O', 9340379145768, 'Linfa Freestanding Bath with Overflow (Left Hand Corner) 1500x750x585mm', 'BATH', 'LINFA', 'SCO 15075LH WITH OVERFLOW', 0, 0, 0),
  ('ABF15075N', 9340379136513, 'Envy Freestanding Bath 1500x750x585mm', 'BATH', 'ENVY', 'FLO-1500', 0, 0, 0),
  ('ABF15075N-M', 9340379136520, 'Envy Freestanding Bath 1500x750x585mm Matt White', 'BATH', 'ENVY', 'FLO-1500-M', 0, 0, 0),
  ('ABF15075Q', 9340379043095, 'Quadro Freestanding Bath 1500x750x585mm', 'BATH', 'QUADRO', 'ROM-1500', 0, 0, 0),
  ('ABF15075Q-M', 9340379138722, 'Quadro Freestanding Bath 1500x750x585mm Matt White', 'BATH', 'QUADRO', 'ROM-1500 -M', 0, 0, 0),
  ('ABF15075Q2-MO', 9340379153329, 'Quadro II Freestanding Bath with Overflow 1500x750x585mm Matt White', 'BATH', 'QUADRO', 'STU15075S MATT WHITE WITH OVERFLOW', 0, 0, 0),
  ('ABF15075Q2-O', 9340379153336, 'Quadro II Freestanding Bath with Overflow 1500x750x585mm', 'BATH', 'QUADRO', 'STU15075S WITH OVERFLOW', 0, 0, 0),
  ('ABF15075RI', 9340379145775, 'Linfa Freestanding Bath (Right Hand Corner) 1500x750x585mm', 'BATH', 'LINFA', 'SCO 15075RH', 0, 0, 0),
  ('ABF15075RI-M', 9340379145782, 'Linfa Freestanding Bath (Right Hand Corner) 1500x750x585mm Matt White', 'BATH', 'LINFA', 'SCO 15075RH-M', 0, 0, 0),
  ('ABF15075RI-MO', 9340379145799, 'Linfa Freestanding Bath with Overflow (Right Hand Corner) 1500x750x585mm Matt White', 'BATH', 'LINFA', 'SCO 15075RH-M WITH OVERFLOW', 0, 0, 0),
  ('ABF15075RI-O', 9340379145805, 'Linfa Freestanding Bath with Overflow (Right Hand Corner) 1500x750x585mm', 'BATH', 'LINFA', 'SCO 15075RH WITH OVERFLOW', 0, 0, 0),
  ('ABF15075U', 9340379043361, 'Quasar Freestanding Bath 1500x750x585mm', 'BATH', 'QUASAR', 'PAR-1500', 0, 0, 0),
  ('ABF15075U-M', 9340379061792, 'Quasar Freestanding Bath 1500x750x585mm Matt White', 'BATH', 'QUASAR', 'PAR-1500 -M', 0, 0, 0),
  ('ABF15075VD', 9340379048120, 'Ovation D Freestanding Bath 1500x750x585mm', 'BATH', 'OVATION', 'LON-1500D', 0, 0, 0),
  ('ABF15075VD-M', 9340379048137, 'Ovation D Freestanding Bath 1500x750x585mm Matt White', 'BATH', 'OVATION', 'LON-1500D-MATT WHITE', 0, 0, 0),
  ('ABF15075VD-O', NULL, 'Ovation D Freestanding Bath with Overflow 1500x750x585mm', 'BATH', 'OVATION', 'LON-1500D WITH OVERFLOW', 0, 0, 0),
  ('ABF15080O', 9340379042180, 'Ovale Freestanding Bath 1500x800x585mm', 'BATH', 'OVALE', 'BOS-1500', 0, 0, 0),
  ('ABF15080O-M', 9340379059935, 'Ovale Freestanding Bath 1500x800x585mm Matt White', 'BATH', 'OVALE', 'BOS-1500-M', 0, 0, 0),
  ('ABF15285M', 9340379047062, 'Loom Freestanding Bath 1529x850x620mm', 'BATH', 'LOOM', 'ORL-1529', 0, 0, 0),
  ('ABF15285M-M', 9340379048144, 'Loom Freestanding Bath 1529x850x620mm Matt White', 'BATH', 'LOOM', 'ORL-1529-M', 0, 0, 0),
  ('ABF15285M-MO', 9340379153343, 'Loom Freestanding Bath 1529x850x620mm with overflow Matt White', 'BATH', 'LOOM', NULL, 0, 0, 0),
  ('ABF15570E', 9340379061808, 'Elli Freestanding Bath 1550x700x600mm', 'BATH', 'ELLI', 'RBR-1570', 0, 0, 0),
  ('ABF15570E.AS', 9340379153350, 'Elli Freestanding Bath 1550x700X600mm - Anti Slip', 'BATH', 'ELLI', 'RBR-1570 - ANTI SLIP', 0, 0, 0),
  ('ABF16579Q', 9340379061815, 'Quasar Wall Faced Bath with Rear Tap Landing 1650x790x600mm', 'BATH', 'QUASAR', 'RCO-1670', 0, 0, 0),
  ('ABF16585V', 9340379042203, 'Ovation Freestanding Bath 1650x850x600mm', 'BATH', 'OVATION', 'VEN-1650', 0, 0, 0),
  ('ABF16585V-M', 9340379138739, 'Ovation Freestanding Bath 1650x850x600mm Matt White', 'BATH', 'OVATION', 'VEN-1650-M', 0, 0, 0),
  ('ABF16585V-O', NULL, 'Ovation Freestanding Bath with Overflow 1650x850x600mm', 'BATH', 'OVATION', 'VEN-1650 WITH OVERFLOW', 0, 0, 0),
  ('ABF16585V-TS', 9340379042210, 'Ovation Freestanding Bath 1650x850x600mm w/ Integrated Tap Set', 'BATH', 'OVATION', NULL, 0, 0, 0),
  ('ABF16585V-TS-D3', 9340379061822, 'Ovation Freestanding Bath 1650x850x600mm w/ Integrated Tap Set (3 Way)', 'BATH', 'OVATION', NULL, 0, 0, 0),
  ('ABF16775QT', 9340379150595, 'QTS Freestanding Bath 1670x750x900mm', 'BATH', 'QTS', 'ELE17075S', 0, 0, 0),
  ('ABF16785M', 9340379047079, 'Loom Freestanding Bath 1670x850x620mm', 'BATH', 'LOOM', 'ORL-1670', 0, 0, 0),
  ('ABF16785M-M', 9340379048151, 'Loom Freestanding Bath 1670x850x620mm Matt White', 'BATH', 'LOOM', 'ORL-1670-M', 0, 0, 0),
  ('ABF16785M-MO', NULL, 'Loom Freestanding Bath 1670x850x620mm with overflow Matt White', 'BATH', 'LOOM', NULL, 0, 0, 0),
  ('ABF17075E', 9340379061839, 'Elli Freestanding Bath 1700x750x600mm', 'BATH', 'ELLI', 'ELL-1700', 0, 0, 0),
  ('ABF17075L', 9340379038213, 'Elli II Freestanding Bath 1700x750x600mm', 'BATH', 'ELLI', 'ELL 1775S', 0, 0, 0),
  ('ABF17075L-M', 9340379038220, 'Elli II Freestanding Bath 1700x750x600mm Matt White', 'BATH', 'ELLI', 'ELL 1775S MW', 0, 0, 0),
  ('ABF17075L-MO', 9340379048700, 'Elli II Freestanding Bath with Overflow 1700x750x600mm Matt White', 'BATH', 'ELLI', 'ELL 1775S  MW & OVERFLOW', 0, 0, 0),
  ('ABF17075L-O', 9340379139583, 'Elli II Freestanding Bath with Overflow 1700x750x600mm', 'BATH', 'ELLI', 'ELL 1775S & OVERFLOW', 0, 0, 0),
  ('ABF17075Q', 9340379043101, 'Quadro Freestanding Bath 1700x750x585mm', 'BATH', 'QUADRO', 'ROM-1700', 0, 0, 0),
  ('ABF17075Q-M', 9340379138746, 'Quadro Freestanding Bath 1700x750x585mm Matt White', 'BATH', 'QUADRO', 'ROM-1700-M', 0, 0, 0),
  ('ABF17075Q2-MO', 9340379153367, 'Quadro II Freestanding Bath with Overflow 1700x750x585mm Matt White', 'BATH', 'QUADRO', 'STU 17075S MATT WHITE WITH OVERFLOW', 0, 0, 0),
  ('ABF17075Q2-O', 9340379153374, 'Quadro II Freestanding Bath with Overflow 1700x750x585mm', 'BATH', 'QUADRO', 'STU 17075S WITH OVERFLOW', 0, 0, 0),
  ('ABF17080B', 9340379048168, 'Blade Freestanding Bath (Back to Wall) 1700x800x585mm', 'BATH', 'BLADE', 'BAR-1700', 0, 0, 0),
  ('ABF17080B-M', 9340379048175, 'Blade Freestanding Bath (Back to Wall) 1700x800x585mm Matt White', 'BATH', 'BLADE', 'BAR-1700-M', 0, 0, 0),
  ('ABF17080B-O', NULL, 'Blade Freestanding Bath With Overflow (Back to Wall) 1700x800x585mm', 'BATH', 'BLADE', 'BAR-1700 - WITH OVERFLOW', 0, 0, 0)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  barcode = COALESCE(EXCLUDED.barcode, warehouse_items.barcode),
  categoria = EXCLUDED.categoria,
  subcategoria = EXCLUDED.subcategoria,
  supplier_product_code = COALESCE(EXCLUDED.supplier_product_code, warehouse_items.supplier_product_code),
  atualizado_em = CURRENT_TIMESTAMP;

INSERT INTO warehouse_items (
  codigo, barcode, nome, categoria, subcategoria, supplier_product_code,
  quantidade, quantidade_minima, preco_unitario
)
VALUES
  ('ABF17080BE', 9340379048083, 'Ellisse Freestanding Bath (Back to Wall) 1700x800x585mm', 'BATH', 'ELLISSE', 'MIA-1780D', 0, 0, 0),
  ('ABF17080BE-M', 9340379048090, 'Ellisse Freestanding Bath (Back to Wall) 1700x800x585mm Matt White', 'BATH', 'ELLISSE', 'MIA-1780D-M', 0, 0, 0),
  ('ABF17080BI', 9340379145812, 'Linfa Freestanding Bath (Back to Wall) 1700x800x585mm', 'BATH', 'LINFA', 'SCO 17080BTW', 0, 0, 0),
  ('ABF17080BI-M', 9340379145829, 'Linfa Freestanding Bath (Back to Wall) 1700x800x585mm Matt White', 'BATH', 'LINFA', 'SCO 17080BTW-M', 0, 0, 0),
  ('ABF17080BI-MO', 9340379145836, 'Linfa Freestanding Bath with Overflow (Back to Wall) 1700x800x585mm Matt White', 'BATH', 'LINFA', 'SCO 17080BTW-M WITH OVERFLOW', 0, 0, 0),
  ('ABF17080BI-O', 9340379145843, 'Linfa Freestanding Bath with Overflow (Back to Wall) 1700x800x585mm', 'BATH', 'LINFA', 'SCO 17080BTW WITH OVERFLOW', 0, 0, 0),
  ('ABF17080E', 9340379038879, 'Ellisse Freestanding Bath 1700x800x585mm', 'BATH', 'ELLISSE', 'PAC 17080S', 0, 0, 0),
  ('ABF17080E-M', NULL, 'Ellisse Freestanding Bath 1700x800x585mm Matt White', 'BATH', 'ELLISSE', 'PAC 17080S MW', 0, 0, 0),
  ('ABF17080E-MO', 9340379150618, 'Ellisse Freestanding Bath with Overflow 1700x800x585mm Matt White', 'BATH', 'ELLISSE', 'PAC 17080S MW & OVERFLOW', 0, 0, 0),
  ('ABF17080E-O', 9340379150601, 'Ellisse Freestanding Bath with Overflow 1700x800x585mm', 'BATH', 'ELLISSE', 'PAC 17080S & OVERFLOW', 0, 0, 0),
  ('ABF17080F', 9340379033133, 'Float Freestanding Bath 1700x800x585mm', 'BATH', 'FLOAT', 'MUN 17080S', 0, 0, 0),
  ('ABF17080F-M', 9340379033140, 'Float Freestanding Bath 1700x800x585mm Matt White', 'BATH', 'FLOAT', 'MUN 17080S MW', 0, 0, 0),
  ('ABF17080F-MO', NULL, 'Float Freestanding Bath 1700x800x585mm Matt White', 'BATH', 'FLOAT', 'MUN 17080S MW & OVERFLOW', 0, 0, 0),
  ('ABF17080F-O', NULL, 'Float Freestanding Bath with Overflow 1700x800x585mm', 'BATH', 'FLOAT', 'MUN 17080S & OVERFLOW', 0, 0, 0),
  ('ABF17080H', 9340379033096, 'Hermitage Freestanding Bath 1700x805x600mm', 'BATH', 'HERMITAGE', 'NYK-1700', 0, 0, 0),
  ('ABF17080H-M', 9340379033102, 'Hermitage Freestanding Bath 1700x805x600mm Matt White', 'BATH', 'HERMITAGE', 'NYK-1700-M', 0, 0, 0),
  ('ABF17080H-O', NULL, 'Hermitage Freestanding Bath with Overflow 1700x805x600mm', 'BATH', 'HERMITAGE', 'NYK-1700 WITH OVERFLOW', 0, 0, 0),
  ('ABF17080H2-MO', 9340379150588, 'Hermitage II Freestanding Bath with Overflow 1700x800x585mm Matt White', 'BATH', 'HERMITAGE', 'NAN 17080S MATT WHITE WITH OVERFLOW', 0, 0, 0),
  ('ABF17080H2-O', 9340379150571, 'Hermitage II Freestanding Bath with Overflow 1700x800x585mm', 'BATH', 'HERMITAGE', 'NAN 17080S WITH OVERFLOW', 0, 0, 0),
  ('ABF17080LE', 9340379048809, 'Ellisse Freestanding Bath (Left Hand Curve) 1700x800x585mm', 'BATH', 'ELLISSE', 'MIA-1780L', 0, 0, 0),
  ('ABF17080LE-M', 9340379048816, 'Ellisse Freestanding Bath (Left Hand Curve) 1700x800x585mm Matt White', 'BATH', 'ELLISSE', 'MIA-1780L-M', 0, 0, 0),
  ('ABF17080LI', 9340379145850, 'Linfa Freestanding Bath (Left Hand Corner) 1700x800x585mm', 'BATH', 'LINFA', 'SCO 17080LH', 0, 0, 0),
  ('ABF17080LI-M', 9340379145867, 'Linfa Freestanding Bath (Left Hand Corner) 1700x800x585mm Matt White', 'BATH', 'LINFA', 'SCO 17080LH-M', 0, 0, 0),
  ('ABF17080LI-MO', 9340379145874, 'Linfa Freestanding Bath with Overflow (Left Hand Corner) 1700x800x585mm Matt White', 'BATH', 'LINFA', 'SCO 17080LH-M WITH OVERFLOW', 0, 0, 0),
  ('ABF17080LI-O', 9340379145881, 'Linfa Freestanding Bath with Overflow (Left Hand Corner) 1700x800x585mm', 'BATH', 'LINFA', 'SCO 17080LH WITH OVERFLOW', 0, 0, 0),
  ('ABF17080N', 9340379136537, 'Envy Freestanding Bath 1700x800x585mm', 'BATH', 'ENVY', 'FLO-1700', 0, 0, 0),
  ('ABF17080N-M', 9340379136544, 'Envy Freestanding Bath 1700x800x585mm Matt White', 'BATH', 'ENVY', 'FLO-1700-M', 0, 0, 0),
  ('ABF17080RE', 9340379048069, 'Ellisse Freestanding Bath (Right Hand Curve) 1700x800x585mm', 'BATH', 'ELLISSE', 'MIA-1780R', 0, 0, 0),
  ('ABF17080RE-M', 9340379048076, 'Ellisse Freestanding Bath (Right Hand Curve) 1700x800x585mm Matt White', 'BATH', 'ELLISSE', 'MIA-1780R-M', 0, 0, 0),
  ('ABF17080RI', 9340379145898, 'Linfa Freestanding Bath (Right Hand Corner) 1700x800x585mm', 'BATH', 'LINFA', 'SCO 17080RH', 0, 0, 0),
  ('ABF17080RI-M', 9340379145904, 'Linfa Freestanding Bath (Right Hand Corner) 1700x800x585mm Matt White', 'BATH', 'LINFA', 'SCO 17080RH-M', 0, 0, 0),
  ('ABF17080RI-MO', 9340379145911, 'Linfa Freestanding Bath with Overflow (Right Hand Corner) 1700x800x585mm Matt White', 'BATH', 'LINFA', 'SCO 17080RH-M WITH OVERFLOW', 0, 0, 0),
  ('ABF17080RI-O', 9340379145928, 'Linfa Freestanding Bath with Overflow (Right Hand Corner) 1700x800x585mm', 'BATH', 'LINFA', 'SCO 17080RH WITH OVERFLOW', 0, 0, 0),
  ('ABF17080U', 9340379043378, 'Quasar Freestanding Bath 1700x800x585mm', 'BATH', 'QUASAR', 'PAR-1700', 0, 0, 0),
  ('ABF17080U-M', 9340379136551, 'Quasar Freestanding Bath 1700x800x585mm Matt White', 'BATH', 'QUASAR', 'PAR-1700 -M', 0, 0, 0),
  ('ABF17082O', 9340379042197, 'Ovale Freestanding Bath 1700x820x585mm', 'BATH', 'OVALE', 'BOS-1700', 0, 0, 0),
  ('ABF17082O-M', 9340379138753, 'Ovale Freestanding Bath 1700x820x585mm Matt White', 'BATH', 'OVALE', 'BOS-1700-M', 0, 0, 0),
  ('ABF18083E', 9340379061846, 'Loft Freestanding Bath 1800x830x560mm', 'BATH', 'LOFT', 'RCA-1883', 0, 0, 0),
  ('ABF18083E.AS', 9340379153381, 'Loft Freestanding Bath 1800x830x560mm - Anti Slip', 'BATH', 'LOFT', 'RCA-1883 - ANTI SLIP', 0, 0, 0),
  ('ABFMA.SW', NULL, 'Naturale Marble Bath Freestanding 1680x770x563mm', 'BATH', 'NATURALE', 'WB.AG.GIULIA01', 0, 0, 0),
  ('ABFSSTP', 9340379150380, 'Soak Step Gloss White', 'BATH', 'SOAK', 'GLOSS STEP', 0, 0, 0),
  ('ABFSSTP-M', 9340379150397, 'Soak Step Matt White', 'BATH', 'SOAK', 'MATT WHITE STEP', 0, 0, 0),
  ('PB14070E', 9340379070381, 'Envy Bath 1400x700', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB15070E', 9340379039210, 'Envy Bath 1500x700', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB15070E-AS', NULL, 'Envy Bath 1500x700 (with Anti-Slip surface)', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB16070A', NULL, 'Atomic Bath 1600x700', 'BATH', 'ATOMIC', NULL, 0, 0, 0),
  ('PB16070E', 9340379039227, 'Envy Bath 1600x700', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB16070E-AS', NULL, 'Envy Bath 1600x700 (with Anti-Slip surface)', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB16075E-O', NULL, 'Envy Bath 1600x750 (with Overflow)', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB17070E', 9340379039234, 'Envy Bath 1700x700', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB17075E', NULL, 'Envy Bath 1700x750', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB17075E-O', NULL, 'Envy Bath 1700x750 (with Overflow)', 'BATH', 'ENVY', NULL, 0, 0, 0),
  ('PB17075N', NULL, 'Nettuno Bath 1700x750', 'BATH', 'NETTUNO', NULL, 0, 0, 0),
  ('PB17075ND-O', NULL, 'Nettuno Bath (Double ended) 1700x750 (with Overflow)', 'BATH', 'NETTUNO', NULL, 0, 0, 0),
  ('PB18080C', 9340379037285, 'Curva Bath 1800x800', 'BATH', 'CURVA', NULL, 0, 0, 0),
  ('PB18080S', 9340379044665, 'Sottovale Bath 1800x800', 'BATH', 'SOTTOVALE', NULL, 0, 0, 0),
  ('PB18080T', NULL, 'Atlas Bath 1800x800', 'BATH', 'ATLAS', NULL, 0, 0, 0),
  ('PB187054PL', NULL, 'Saturnia Freestanding Bath 1800 x 700 x 540mm Pietra Lavica', 'BATH', 'SATURNIA', NULL, 0, 0, 0)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  barcode = COALESCE(EXCLUDED.barcode, warehouse_items.barcode),
  categoria = EXCLUDED.categoria,
  subcategoria = EXCLUDED.subcategoria,
  supplier_product_code = COALESCE(EXCLUDED.supplier_product_code, warehouse_items.supplier_product_code),
  atualizado_em = CURRENT_TIMESTAMP;
COMMIT;

-- Verificacao:
-- SELECT COUNT(*)::int AS total_bath
-- FROM warehouse_items
-- WHERE UPPER(TRIM(categoria)) = 'BATH';
--
-- SELECT subcategoria, COUNT(*)::int AS qtd
-- FROM warehouse_items
-- WHERE UPPER(TRIM(categoria)) = 'BATH'
-- GROUP BY subcategoria
-- ORDER BY subcategoria;
--
-- SELECT codigo, nome, subcategoria, supplier_product_code, barcode
-- FROM warehouse_items
-- WHERE UPPER(TRIM(codigo)) = 'ABFSSTP-M';
