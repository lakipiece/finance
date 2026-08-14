-- 평문 비밀번호 → bcrypt 해시 전환 (개선점 #22)
-- auth.ts는 '$2'로 시작하면 bcrypt.compare, 아니면 평문 비교(하위호환)하므로
-- 이 마이그레이션 전후 모두 로그인이 동작한다.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 아직 평문인 행만 해시 ($2a$/$2b$로 시작하지 않는 값)
UPDATE users
SET password_hash = crypt(password_hash, gen_salt('bf', 12))
WHERE password_hash NOT LIKE '$2%';
