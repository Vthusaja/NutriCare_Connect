-- DECIMAL(4,2) only allows up to 99.99; fever values in °F or typos caused SQL 1264.
ALTER TABLE health_checks
  MODIFY temperature DECIMAL(5, 2) NULL;
