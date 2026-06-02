-- Atualizar os 10 registros da tabela customer:
-- nome = "Harvey Norman", endereços na Austrália
-- Atualiza por cust_cd_code (CUST001 a CUST010)

UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '100 George St, Sydney NSW 2000' WHERE cust_cd_code = 'CUST001';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '250 Elizabeth St, Melbourne VIC 3000' WHERE cust_cd_code = 'CUST002';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '270 Queen St, Brisbane QLD 4000' WHERE cust_cd_code = 'CUST003';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '800 Hay St, Perth WA 6000' WHERE cust_cd_code = 'CUST004';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '100 Rundle Mall, Adelaide SA 5000' WHERE cust_cd_code = 'CUST005';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '3 Southport Central, Gold Coast QLD 4215' WHERE cust_cd_code = 'CUST006';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '1 Hunter St, Newcastle NSW 2300' WHERE cust_cd_code = 'CUST007';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '1 Canberra Centre, Canberra ACT 2601' WHERE cust_cd_code = 'CUST008';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '116 Liverpool St, Hobart TAS 7000' WHERE cust_cd_code = 'CUST009';
UPDATE customer SET cust_nm_customer = 'Harvey Norman', cust_ds_address = '159 Church St, Parramatta NSW 2150' WHERE cust_cd_code = 'CUST010';
