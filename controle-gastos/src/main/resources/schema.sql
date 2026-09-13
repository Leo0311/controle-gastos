-- ============================================================================
-- ARQUIVO GERADO AUTOMATICAMENTE - NÃO EDITE À MÃO.
--
-- Dump (pg_dump --schema-only) do schema resultante de aplicar TODAS as
-- migrations do Flyway do zero, num Postgres 18 (mesma major version do Neon
-- de produção). Serve só pro app de console Java (controle-gastos/), que não
-- usa Spring nem Flyway - pra criar as tabelas num banco novo:
--   psql -d controle_gastos -f schema.sql
--
-- Fonte de verdade real: controle-gastos-api/src/main/resources/db/migration/.
-- Depois de criar ou mudar uma migration, regenere este arquivo com:
--   scripts/regenerar-schema-console.sh
-- O CI (job migration-guard, cenário fresh) falha se este arquivo divergir do
-- que as migrations realmente produzem.
-- ============================================================================

--
-- PostgreSQL database dump
--



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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migracoes_pontuais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migracoes_pontuais (
    nome text NOT NULL,
    aplicada_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    usuario_id integer,
    nome character varying(60) NOT NULL,
    emoji character varying(16) DEFAULT '📁'::character varying NOT NULL
);


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: categorias_ordem_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_ordem_usuario (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    categoria_id integer NOT NULL,
    posicao integer NOT NULL
);


--
-- Name: categorias_ordem_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_ordem_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_ordem_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_ordem_usuario_id_seq OWNED BY public.categorias_ordem_usuario.id;


--
-- Name: compras_parceladas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compras_parceladas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    descricao character varying(150) NOT NULL,
    valor_total numeric(12,2) NOT NULL,
    numero_parcelas integer NOT NULL,
    categoria_id integer NOT NULL,
    subcategoria_id integer,
    orcamento_id integer,
    dia_do_mes integer NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT compras_parceladas_dia_do_mes_check CHECK (((dia_do_mes >= 1) AND (dia_do_mes <= 31))),
    CONSTRAINT compras_parceladas_numero_parcelas_check CHECK (((numero_parcelas >= 2) AND (numero_parcelas <= 120))),
    CONSTRAINT compras_parceladas_valor_total_check CHECK ((valor_total > (0)::numeric))
);


--
-- Name: compras_parceladas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compras_parceladas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compras_parceladas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compras_parceladas_id_seq OWNED BY public.compras_parceladas.id;


--
-- Name: gastos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos (
    id integer NOT NULL,
    descricao character varying(150) NOT NULL,
    valor numeric(12,2) NOT NULL,
    categoria character varying(60) NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    usuario_id integer,
    orcamento_id integer,
    subcategoria character varying(60),
    categoria_id integer,
    subcategoria_id integer,
    gasto_recorrente_id integer,
    compra_parcelada_id integer,
    status_pagamento character varying(10) DEFAULT 'PAGO'::character varying NOT NULL,
    vencimento_original date,
    data_pagamento date,
    CONSTRAINT gastos_status_pagamento_check CHECK (((status_pagamento)::text = ANY ((ARRAY['PENDENTE'::character varying, 'PAGO'::character varying])::text[]))),
    CONSTRAINT gastos_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: gastos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gastos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gastos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gastos_id_seq OWNED BY public.gastos.id;


--
-- Name: gastos_recorrentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos_recorrentes (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    descricao character varying(150) NOT NULL,
    valor numeric(12,2) NOT NULL,
    categoria_id integer NOT NULL,
    subcategoria_id integer,
    dia_do_mes integer NOT NULL,
    orcamento_id integer,
    ativo boolean DEFAULT true NOT NULL,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT gastos_recorrentes_dia_do_mes_check CHECK (((dia_do_mes >= 1) AND (dia_do_mes <= 31))),
    CONSTRAINT gastos_recorrentes_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: gastos_recorrentes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gastos_recorrentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gastos_recorrentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gastos_recorrentes_id_seq OWNED BY public.gastos_recorrentes.id;


--
-- Name: metas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    mes integer NOT NULL,
    ano integer NOT NULL,
    valor_meta numeric(12,2) NOT NULL,
    CONSTRAINT metas_ano_check CHECK ((ano > 0)),
    CONSTRAINT metas_mes_check CHECK (((mes >= 1) AND (mes <= 12))),
    CONSTRAINT metas_valor_meta_check CHECK ((valor_meta > (0)::numeric))
);


--
-- Name: metas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metas_id_seq OWNED BY public.metas.id;


--
-- Name: orcamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orcamentos (
    id integer NOT NULL,
    categoria character varying(60) NOT NULL,
    valor_limite numeric(12,2) NOT NULL,
    mes integer NOT NULL,
    ano integer NOT NULL,
    usuario_id integer,
    subcategoria character varying(60),
    categoria_id integer,
    subcategoria_id integer,
    CONSTRAINT orcamentos_ano_check CHECK ((ano > 0)),
    CONSTRAINT orcamentos_mes_check CHECK (((mes >= 1) AND (mes <= 12))),
    CONSTRAINT orcamentos_valor_limite_check CHECK ((valor_limite > (0)::numeric))
);


--
-- Name: orcamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orcamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orcamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orcamentos_id_seq OWNED BY public.orcamentos.id;


--
-- Name: subcategorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcategorias (
    id integer NOT NULL,
    categoria_id integer NOT NULL,
    usuario_id integer,
    nome character varying(60) NOT NULL,
    emoji character varying(16) DEFAULT '📁'::character varying NOT NULL
);


--
-- Name: subcategorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subcategorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subcategorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subcategorias_id_seq OWNED BY public.subcategorias.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nome character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    senha character varying(255),
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    token_redefinicao_senha character varying(255),
    token_redefinicao_expiracao timestamp without time zone,
    renda_mensal numeric(12,2),
    token_version integer DEFAULT 0 NOT NULL,
    google_id character varying(255)
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: categorias_ordem_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_ordem_usuario ALTER COLUMN id SET DEFAULT nextval('public.categorias_ordem_usuario_id_seq'::regclass);


--
-- Name: compras_parceladas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_parceladas ALTER COLUMN id SET DEFAULT nextval('public.compras_parceladas_id_seq'::regclass);


--
-- Name: gastos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos ALTER COLUMN id SET DEFAULT nextval('public.gastos_id_seq'::regclass);


--
-- Name: gastos_recorrentes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_recorrentes ALTER COLUMN id SET DEFAULT nextval('public.gastos_recorrentes_id_seq'::regclass);


--
-- Name: metas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas ALTER COLUMN id SET DEFAULT nextval('public.metas_id_seq'::regclass);


--
-- Name: orcamentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos ALTER COLUMN id SET DEFAULT nextval('public.orcamentos_id_seq'::regclass);


--
-- Name: subcategorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategorias ALTER COLUMN id SET DEFAULT nextval('public.subcategorias_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: _migracoes_pontuais _migracoes_pontuais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migracoes_pontuais
    ADD CONSTRAINT _migracoes_pontuais_pkey PRIMARY KEY (nome);


--
-- Name: categorias_ordem_usuario categorias_ordem_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_ordem_usuario
    ADD CONSTRAINT categorias_ordem_usuario_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: compras_parceladas compras_parceladas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_parceladas
    ADD CONSTRAINT compras_parceladas_pkey PRIMARY KEY (id);


--
-- Name: gastos gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_pkey PRIMARY KEY (id);


--
-- Name: gastos_recorrentes gastos_recorrentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_recorrentes
    ADD CONSTRAINT gastos_recorrentes_pkey PRIMARY KEY (id);


--
-- Name: metas metas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_pkey PRIMARY KEY (id);


--
-- Name: orcamentos orcamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_pkey PRIMARY KEY (id);


--
-- Name: subcategorias subcategorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategorias
    ADD CONSTRAINT subcategorias_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_google_id_key UNIQUE (google_id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_categorias_ordem_usuario_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_ordem_usuario_usuario ON public.categorias_ordem_usuario USING btree (usuario_id);


--
-- Name: idx_categorias_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_usuario ON public.categorias USING btree (usuario_id);


--
-- Name: idx_compras_parceladas_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_parceladas_usuario ON public.compras_parceladas USING btree (usuario_id);


--
-- Name: idx_gastos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_categoria ON public.gastos USING btree (categoria);


--
-- Name: idx_gastos_categoria_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_categoria_id ON public.gastos USING btree (categoria_id);


--
-- Name: idx_gastos_compra_parcelada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_compra_parcelada ON public.gastos USING btree (compra_parcelada_id);


--
-- Name: idx_gastos_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_data ON public.gastos USING btree (data);


--
-- Name: idx_gastos_gasto_recorrente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_gasto_recorrente ON public.gastos USING btree (gasto_recorrente_id);


--
-- Name: idx_gastos_orcamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_orcamento ON public.gastos USING btree (orcamento_id);


--
-- Name: idx_gastos_recorrentes_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_recorrentes_usuario ON public.gastos_recorrentes USING btree (usuario_id);


--
-- Name: idx_gastos_status_pagamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_status_pagamento ON public.gastos USING btree (usuario_id, status_pagamento);


--
-- Name: idx_gastos_subcategoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_subcategoria ON public.gastos USING btree (subcategoria);


--
-- Name: idx_gastos_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gastos_usuario ON public.gastos USING btree (usuario_id);


--
-- Name: idx_metas_usuario_mes_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_metas_usuario_mes_ano ON public.metas USING btree (usuario_id, mes, ano);


--
-- Name: idx_orcamentos_categoria_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_categoria_id ON public.orcamentos USING btree (categoria_id);


--
-- Name: idx_orcamentos_mes_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_mes_ano ON public.orcamentos USING btree (mes, ano);


--
-- Name: idx_orcamentos_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_usuario ON public.orcamentos USING btree (usuario_id);


--
-- Name: idx_subcategorias_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcategorias_categoria ON public.subcategorias USING btree (categoria_id);


--
-- Name: idx_usuarios_token_redefinicao; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_usuarios_token_redefinicao ON public.usuarios USING btree (token_redefinicao_senha) WHERE (token_redefinicao_senha IS NOT NULL);


--
-- Name: uq_categorias_ordem_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_categorias_ordem_usuario ON public.categorias_ordem_usuario USING btree (usuario_id, categoria_id);


--
-- Name: uq_categorias_usuario_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_categorias_usuario_nome ON public.categorias USING btree (COALESCE(usuario_id, 0), lower((nome)::text));


--
-- Name: uq_gastos_recorrente_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_gastos_recorrente_mes ON public.gastos USING btree (gasto_recorrente_id, date_trunc('month'::text, (vencimento_original)::timestamp without time zone)) WHERE (gasto_recorrente_id IS NOT NULL);


--
-- Name: uq_orcamento_usuario_categoria_subcategoria_mes_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_orcamento_usuario_categoria_subcategoria_mes_ano ON public.orcamentos USING btree (usuario_id, categoria_id, COALESCE(subcategoria_id, 0), mes, ano);


--
-- Name: uq_subcategorias_usuario_categoria_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_subcategorias_usuario_categoria_nome ON public.subcategorias USING btree (COALESCE(usuario_id, 0), categoria_id, lower((nome)::text));


--
-- Name: categorias_ordem_usuario categorias_ordem_usuario_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_ordem_usuario
    ADD CONSTRAINT categorias_ordem_usuario_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE CASCADE;


--
-- Name: categorias_ordem_usuario categorias_ordem_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_ordem_usuario
    ADD CONSTRAINT categorias_ordem_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: categorias categorias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: compras_parceladas compras_parceladas_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_parceladas
    ADD CONSTRAINT compras_parceladas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: compras_parceladas compras_parceladas_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_parceladas
    ADD CONSTRAINT compras_parceladas_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;


--
-- Name: compras_parceladas compras_parceladas_subcategoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_parceladas
    ADD CONSTRAINT compras_parceladas_subcategoria_id_fkey FOREIGN KEY (subcategoria_id) REFERENCES public.subcategorias(id);


--
-- Name: compras_parceladas compras_parceladas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras_parceladas
    ADD CONSTRAINT compras_parceladas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: gastos gastos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: gastos gastos_compra_parcelada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_compra_parcelada_id_fkey FOREIGN KEY (compra_parcelada_id) REFERENCES public.compras_parceladas(id) ON DELETE SET NULL;


--
-- Name: gastos gastos_gasto_recorrente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_gasto_recorrente_id_fkey FOREIGN KEY (gasto_recorrente_id) REFERENCES public.gastos_recorrentes(id) ON DELETE SET NULL;


--
-- Name: gastos gastos_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;


--
-- Name: gastos_recorrentes gastos_recorrentes_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_recorrentes
    ADD CONSTRAINT gastos_recorrentes_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: gastos_recorrentes gastos_recorrentes_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_recorrentes
    ADD CONSTRAINT gastos_recorrentes_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;


--
-- Name: gastos_recorrentes gastos_recorrentes_subcategoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_recorrentes
    ADD CONSTRAINT gastos_recorrentes_subcategoria_id_fkey FOREIGN KEY (subcategoria_id) REFERENCES public.subcategorias(id);


--
-- Name: gastos_recorrentes gastos_recorrentes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_recorrentes
    ADD CONSTRAINT gastos_recorrentes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: gastos gastos_subcategoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_subcategoria_id_fkey FOREIGN KEY (subcategoria_id) REFERENCES public.subcategorias(id);


--
-- Name: gastos gastos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: metas metas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: orcamentos orcamentos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);


--
-- Name: orcamentos orcamentos_subcategoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_subcategoria_id_fkey FOREIGN KEY (subcategoria_id) REFERENCES public.subcategorias(id);


--
-- Name: orcamentos orcamentos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: subcategorias subcategorias_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategorias
    ADD CONSTRAINT subcategorias_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE CASCADE;


--
-- Name: subcategorias subcategorias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategorias
    ADD CONSTRAINT subcategorias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- PostgreSQL database dump complete
--


