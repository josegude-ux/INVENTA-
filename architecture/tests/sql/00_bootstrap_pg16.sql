-- Disposable PostgreSQL 16 only. Synthetic roles and basic INVENTA references.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.products(code text PRIMARY KEY, description text NOT NULL, unit text NOT NULL, barcode text);
CREATE TABLE public.locations(code text PRIMARY KEY);
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.products(code,description,unit) VALUES ('0000123','Producto sintetico','UD');
INSERT INTO public.locations(code) VALUES ('A-01');
