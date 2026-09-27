-- 이력 보호: 종목·계좌를 지우면 과거 스냅샷 보유내역·배당·입출금 원장이 연쇄 삭제되던 것을 막는다.
-- 이력이 있는 종목/계좌는 삭제가 거부되고(API가 409로 안내), 이력이 없을 때만 지워진다.
-- 스냅샷 → holdings 는 스냅샷 삭제 시 함께 지우는 게 맞으므로 CASCADE 유지.
-- 종목 메타데이터(account_securities, security_tags)도 CASCADE 유지.

BEGIN;

ALTER TABLE holdings DROP CONSTRAINT holdings_security_id_fkey,
  ADD CONSTRAINT holdings_security_id_fkey FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE RESTRICT;
ALTER TABLE holdings DROP CONSTRAINT holdings_account_id_fkey,
  ADD CONSTRAINT holdings_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE dividends DROP CONSTRAINT dividends_security_id_fkey,
  ADD CONSTRAINT dividends_security_id_fkey FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE RESTRICT;
ALTER TABLE dividends DROP CONSTRAINT dividends_account_id_fkey,
  ADD CONSTRAINT dividends_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE account_cashflows DROP CONSTRAINT account_cashflows_account_id_fkey,
  ADD CONSTRAINT account_cashflows_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

COMMIT;
