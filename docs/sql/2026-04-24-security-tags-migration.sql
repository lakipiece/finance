-- security_tags: 종목당 다수 태그 지원 (1:n)
CREATE TABLE IF NOT EXISTS security_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(security_id, tag)
);

