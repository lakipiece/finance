-- Finance 운영 DB 스키마 (pg_dump --schema-only)
-- 생성: 2026-10-03 21:53 · scripts/dump-schema.sh

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_cashflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_cashflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    flow_date date NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    memo text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_cashflows_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT account_cashflows_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'withdrawal'::text, 'opening'::text])))
);


--
-- Name: account_securities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_securities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    security_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    broker text NOT NULL,
    owner text,
    created_at timestamp with time zone DEFAULT now(),
    sort_order integer DEFAULT 0,
    type_id uuid,
    currency_id uuid,
    dividend_eligible boolean DEFAULT true NOT NULL,
    dividend_tax_rate numeric(5,2),
    archived_at timestamp with time zone,
    memo text
);


--
-- Name: COLUMN accounts.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.archived_at IS '보관 시각 — NULL이 아니면 관리 목록·선택지에서 숨김 (이력·평가에는 유지)';


--
-- Name: COLUMN accounts.memo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.memo IS '계좌 메모 (자유 텍스트) — 화면 곳곳에서 계좌명 툴팁으로 표시';


--
-- Name: asset_valuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_valuations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    val_date date NOT NULL,
    amount bigint NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_items (
    id bigint NOT NULL,
    year smallint NOT NULL,
    category text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    annual_plan integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    note text DEFAULT ''::text NOT NULL
);


--
-- Name: budget_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_items_id_seq OWNED BY public.budget_items.id;


--
-- Name: budget_weekly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_weekly (
    year smallint NOT NULL,
    weekly_amount integer DEFAULT 0 NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    name text NOT NULL,
    color text DEFAULT '#94a3b8'::text NOT NULL
);


--
-- Name: detail_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detail_options (
    id integer NOT NULL,
    name text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    color text DEFAULT '#94a3b8'::text NOT NULL,
    order_idx integer DEFAULT 0 NOT NULL
);


--
-- Name: detail_options_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detail_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detail_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detail_options_id_seq OWNED BY public.detail_options.id;


--
-- Name: dividends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dividends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    security_id uuid,
    paid_at date NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    exchange_rate numeric DEFAULT 1 NOT NULL,
    memo text,
    created_at timestamp with time zone DEFAULT now(),
    tax numeric,
    income_type_id uuid
);


--
-- Name: energy_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.energy_records (
    id bigint NOT NULL,
    year smallint NOT NULL,
    month smallint NOT NULL,
    electricity_amount integer DEFAULT 0 NOT NULL,
    electricity_usage numeric(12,2) DEFAULT 0 NOT NULL,
    water_amount integer DEFAULT 0 NOT NULL,
    water_usage numeric(12,2) DEFAULT 0 NOT NULL,
    hot_water_amount integer DEFAULT 0 NOT NULL,
    hot_water_usage numeric(12,2) DEFAULT 0 NOT NULL,
    heating_amount integer DEFAULT 0 NOT NULL,
    heating_usage numeric(12,3) DEFAULT 0 NOT NULL,
    memo text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT energy_records_month_check CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: energy_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.energy_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: energy_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.energy_records_id_seq OWNED BY public.energy_records.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id bigint NOT NULL,
    expense_date date,
    month smallint NOT NULL,
    year smallint DEFAULT 2022 NOT NULL,
    category text NOT NULL,
    detail text DEFAULT ''::text,
    method text DEFAULT ''::text,
    amount integer NOT NULL,
    source text DEFAULT ''::text,
    source_url text DEFAULT ''::text,
    memo text DEFAULT ''::text,
    member text
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    security_id uuid,
    quantity numeric DEFAULT 0 NOT NULL,
    avg_price numeric,
    total_invested numeric,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    source text DEFAULT 'manual'::text,
    updated_at timestamp with time zone DEFAULT now(),
    snapshot_id uuid,
    avg_fx_rate numeric
);


--
-- Name: COLUMN holdings.avg_fx_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.holdings.avg_fx_rate IS 'USD 종목 평균 매입환율 (KRW/USD) — NULL이면 평가 시점 환율로 원가 환산';


--
-- Name: incomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incomes (
    id bigint NOT NULL,
    income_date date NOT NULL,
    year smallint NOT NULL,
    month smallint NOT NULL,
    category text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    amount integer NOT NULL,
    member text,
    created_at timestamp with time zone DEFAULT now(),
    memo text DEFAULT ''::text NOT NULL,
    CONSTRAINT incomes_category_check CHECK ((category = ANY (ARRAY['급여'::text, '기타'::text])))
);


--
-- Name: incomes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incomes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incomes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incomes_id_seq OWNED BY public.incomes.id;


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    code text NOT NULL,
    display_name text NOT NULL,
    color text DEFAULT '#64748b'::text NOT NULL
);


--
-- Name: option_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.option_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    color_hex text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    is_hidden boolean DEFAULT false
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    name text NOT NULL,
    order_idx integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    color text DEFAULT '#94a3b8'::text NOT NULL
);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: pension_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pension_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pension_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pension_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pension_asset_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    amount bigint NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticker text NOT NULL,
    date date NOT NULL,
    price numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    change_pct numeric,
    exchange text
);


--
-- Name: securities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.securities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticker text NOT NULL,
    name text NOT NULL,
    style text,
    created_at timestamp with time zone DEFAULT now(),
    url text,
    memo text,
    asset_class_id uuid,
    country_id uuid,
    sector_id uuid,
    currency_id uuid,
    style_id uuid,
    fixed_price numeric,
    annual_rate numeric,
    accrual_start date,
    maturity_date date,
    archived_at timestamp with time zone
);


--
-- Name: COLUMN securities.fixed_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.securities.fixed_price IS '고정단가 — NULL이면 시세 조회, 값이 있으면 시세 조회 없이 이 단가로 평가 (종목 통화 기준)';


--
-- Name: COLUMN securities.annual_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.securities.annual_rate IS '연이율 (0.035 = 3.5%) — NULL이면 미수이자 계산 안 함';


--
-- Name: COLUMN securities.accrual_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.securities.accrual_start IS '이자 기산일 — 마지막 이자 지급 기록이 있으면 그쪽이 우선';


--
-- Name: COLUMN securities.maturity_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.securities.maturity_date IS '만기일 — 이 날짜 이후로는 이자가 더 붙지 않음';


--
-- Name: COLUMN securities.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.securities.archived_at IS '보관 시각 — NULL이 아니면 관리 목록·선택지에서 숨김 (이력·평가에는 유지)';


--
-- Name: security_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    security_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: snapshot_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snapshot_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id uuid NOT NULL,
    title text NOT NULL,
    filename text NOT NULL,
    html text NOT NULL,
    size integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    memo text,
    created_at timestamp with time zone DEFAULT now(),
    total_market_value numeric,
    total_invested numeric,
    sector_breakdown jsonb,
    value_updated_at timestamp with time zone,
    asset_class_breakdown jsonb DEFAULT '{}'::jsonb,
    tag_breakdown jsonb DEFAULT '{}'::jsonb,
    account_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    unpriced_tickers text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: COLUMN snapshots.sector_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshots.sector_breakdown IS '섹터별 평가액 (KRW) — 비중은 화면에서 계산';


--
-- Name: COLUMN snapshots.asset_class_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshots.asset_class_breakdown IS '자산군별 평가액 (KRW) — 비중은 화면에서 계산';


--
-- Name: COLUMN snapshots.tag_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshots.tag_breakdown IS '태그별 평가액 (KRW, 태그 중복 가능) — 비중은 화면에서 계산';


--
-- Name: COLUMN snapshots.unpriced_tickers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshots.unpriced_tickers IS '값 갱신 시 스냅샷 날짜 이전 가격이 없어 평균단가로 임시 평가한 종목 티커';


--
-- Name: tangible_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tangible_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    asset_type text DEFAULT '부동산'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    acquired_at date,
    acquisition_price bigint,
    acquisition_note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: target_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.target_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    key text NOT NULL,
    target_pct numeric NOT NULL,
    CONSTRAINT target_allocations_level_check CHECK ((level = ANY (ARRAY['asset_class'::text, 'country'::text, 'style'::text, 'sector'::text, 'ticker'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: budget_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items ALTER COLUMN id SET DEFAULT nextval('public.budget_items_id_seq'::regclass);


--
-- Name: detail_options id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detail_options ALTER COLUMN id SET DEFAULT nextval('public.detail_options_id_seq'::regclass);


--
-- Name: energy_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_records ALTER COLUMN id SET DEFAULT nextval('public.energy_records_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: incomes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes ALTER COLUMN id SET DEFAULT nextval('public.incomes_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: account_cashflows account_cashflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_cashflows
    ADD CONSTRAINT account_cashflows_pkey PRIMARY KEY (id);


--
-- Name: account_securities account_securities_account_id_security_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_securities
    ADD CONSTRAINT account_securities_account_id_security_id_key UNIQUE (account_id, security_id);


--
-- Name: account_securities account_securities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_securities
    ADD CONSTRAINT account_securities_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: asset_valuations asset_valuations_asset_id_val_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_valuations
    ADD CONSTRAINT asset_valuations_asset_id_val_date_key UNIQUE (asset_id, val_date);


--
-- Name: asset_valuations asset_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_valuations
    ADD CONSTRAINT asset_valuations_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_year_category_detail_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_year_category_detail_key UNIQUE (year, category, detail);


--
-- Name: budget_weekly budget_weekly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_weekly
    ADD CONSTRAINT budget_weekly_pkey PRIMARY KEY (year);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (name);


--
-- Name: detail_options detail_options_name_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detail_options
    ADD CONSTRAINT detail_options_name_category_key UNIQUE (name, category);


--
-- Name: detail_options detail_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detail_options
    ADD CONSTRAINT detail_options_pkey PRIMARY KEY (id);


--
-- Name: dividends dividends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dividends
    ADD CONSTRAINT dividends_pkey PRIMARY KEY (id);


--
-- Name: energy_records energy_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_records
    ADD CONSTRAINT energy_records_pkey PRIMARY KEY (id);


--
-- Name: energy_records energy_records_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_records
    ADD CONSTRAINT energy_records_year_month_key UNIQUE (year, month);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_account_security_snapshot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_account_security_snapshot_key UNIQUE NULLS NOT DISTINCT (account_id, security_id, snapshot_id);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: incomes incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (code);


--
-- Name: option_list option_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option_list
    ADD CONSTRAINT option_list_pkey PRIMARY KEY (id);


--
-- Name: option_list option_list_type_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option_list
    ADD CONSTRAINT option_list_type_value_key UNIQUE (type, value);


--
-- Name: payment_methods payment_methods_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_name_key UNIQUE (name);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: pension_assets pension_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pension_assets
    ADD CONSTRAINT pension_assets_pkey PRIMARY KEY (id);


--
-- Name: pension_snapshots pension_snapshots_pension_asset_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pension_snapshots
    ADD CONSTRAINT pension_snapshots_pension_asset_id_snapshot_date_key UNIQUE (pension_asset_id, snapshot_date);


--
-- Name: pension_snapshots pension_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pension_snapshots
    ADD CONSTRAINT pension_snapshots_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_ticker_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_ticker_date_key UNIQUE (ticker, date);


--
-- Name: securities securities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_pkey PRIMARY KEY (id);


--
-- Name: securities securities_ticker_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_ticker_key UNIQUE (ticker);


--
-- Name: security_tags security_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tags
    ADD CONSTRAINT security_tags_pkey PRIMARY KEY (id);


--
-- Name: security_tags security_tags_security_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tags
    ADD CONSTRAINT security_tags_security_id_tag_key UNIQUE (security_id, tag);


--
-- Name: snapshot_reports snapshot_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_reports
    ADD CONSTRAINT snapshot_reports_pkey PRIMARY KEY (id);


--
-- Name: snapshots snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshots
    ADD CONSTRAINT snapshots_pkey PRIMARY KEY (id);


--
-- Name: tangible_assets tangible_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tangible_assets
    ADD CONSTRAINT tangible_assets_pkey PRIMARY KEY (id);


--
-- Name: target_allocations target_allocations_level_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.target_allocations
    ADD CONSTRAINT target_allocations_level_key_key UNIQUE (level, key);


--
-- Name: target_allocations target_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.target_allocations
    ADD CONSTRAINT target_allocations_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_account_cashflows_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_cashflows_account_date ON public.account_cashflows USING btree (account_id, flow_date);


--
-- Name: idx_account_cashflows_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_cashflows_date ON public.account_cashflows USING btree (flow_date);


--
-- Name: idx_budget_items_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_items_year ON public.budget_items USING btree (year);


--
-- Name: idx_dividends_income_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dividends_income_type ON public.dividends USING btree (income_type_id);


--
-- Name: idx_dividends_paid_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dividends_paid_at ON public.dividends USING btree (paid_at);


--
-- Name: idx_energy_records_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_energy_records_year_month ON public.energy_records USING btree (year, month);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category ON public.expenses USING btree (category);


--
-- Name: idx_expenses_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_year_month ON public.expenses USING btree (year, month);


--
-- Name: idx_holdings_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holdings_snapshot ON public.holdings USING btree (snapshot_id);


--
-- Name: idx_incomes_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incomes_year_month ON public.incomes USING btree (year, month);


--
-- Name: idx_price_history_ticker_date_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_ticker_date_desc ON public.price_history USING btree (ticker, date DESC);


--
-- Name: idx_snapshot_reports_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshot_reports_snapshot ON public.snapshot_reports USING btree (snapshot_id, created_at DESC);


--
-- Name: account_cashflows account_cashflows_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_cashflows
    ADD CONSTRAINT account_cashflows_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: account_securities account_securities_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_securities
    ADD CONSTRAINT account_securities_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_securities account_securities_security_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_securities
    ADD CONSTRAINT account_securities_security_id_fkey FOREIGN KEY (security_id) REFERENCES public.securities(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.option_list(id);


--
-- Name: accounts accounts_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.option_list(id);


--
-- Name: asset_valuations asset_valuations_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_valuations
    ADD CONSTRAINT asset_valuations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.tangible_assets(id) ON DELETE CASCADE;


--
-- Name: dividends dividends_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dividends
    ADD CONSTRAINT dividends_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: dividends dividends_income_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dividends
    ADD CONSTRAINT dividends_income_type_id_fkey FOREIGN KEY (income_type_id) REFERENCES public.option_list(id);


--
-- Name: dividends dividends_security_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dividends
    ADD CONSTRAINT dividends_security_id_fkey FOREIGN KEY (security_id) REFERENCES public.securities(id) ON DELETE RESTRICT;


--
-- Name: holdings holdings_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: holdings holdings_security_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_security_id_fkey FOREIGN KEY (security_id) REFERENCES public.securities(id) ON DELETE RESTRICT;


--
-- Name: holdings holdings_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.snapshots(id) ON DELETE CASCADE;


--
-- Name: pension_snapshots pension_snapshots_pension_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pension_snapshots
    ADD CONSTRAINT pension_snapshots_pension_asset_id_fkey FOREIGN KEY (pension_asset_id) REFERENCES public.pension_assets(id) ON DELETE CASCADE;


--
-- Name: securities securities_asset_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_asset_class_id_fkey FOREIGN KEY (asset_class_id) REFERENCES public.option_list(id);


--
-- Name: securities securities_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.option_list(id);


--
-- Name: securities securities_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.option_list(id);


--
-- Name: securities securities_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.option_list(id);


--
-- Name: securities securities_style_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_style_id_fkey FOREIGN KEY (style_id) REFERENCES public.option_list(id);


--
-- Name: security_tags security_tags_security_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tags
    ADD CONSTRAINT security_tags_security_id_fkey FOREIGN KEY (security_id) REFERENCES public.securities(id) ON DELETE CASCADE;


--
-- Name: snapshot_reports snapshot_reports_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_reports
    ADD CONSTRAINT snapshot_reports_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.snapshots(id) ON DELETE CASCADE;


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: dividends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: holdings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: securities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.securities ENABLE ROW LEVEL SECURITY;

--
-- Name: target_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.target_allocations ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


