-- 계좌 메모 — 계좌 이름에 마우스를 올리면 툴팁으로 보여준다
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS memo text;
COMMENT ON COLUMN accounts.memo IS '계좌 메모 (자유 텍스트) — 화면 곳곳에서 계좌명 툴팁으로 표시';
