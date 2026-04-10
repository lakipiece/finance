// Common SQL fragments for joining option_list to resolve FK text values

export const ACCOUNT_SELECT = `
  a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
  a.type_id, a.currency_id,
  t.value  AS type,
  cu.value AS currency
`

export const ACCOUNT_JOINS = `
  LEFT JOIN option_list t  ON a.type_id     = t.id
  LEFT JOIN option_list cu ON a.currency_id  = cu.id
`

export const SECURITY_SELECT = `
  s.id, s.ticker, s.name, s.style, s.url, s.memo, s.created_at,
  s.asset_class_id, s.country_id, s.sector_id, s.currency_id,
  ac.value AS asset_class,
  co.value AS country,
  se.value AS sector,
  cu.value AS currency
`

export const SECURITY_JOINS = `
  LEFT JOIN option_list ac ON s.asset_class_id = ac.id
  LEFT JOIN option_list co ON s.country_id      = co.id
  LEFT JOIN option_list se ON s.sector_id       = se.id
  LEFT JOIN option_list cu ON s.currency_id     = cu.id
`
