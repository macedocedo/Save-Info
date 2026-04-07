💾 Save-Info

Sistema simples de armazenamento de informações (posts com texto, mídia e categorias), utilizando Supabase como backend e hospedado no GitHub Pages.

🔗 Acesse o projeto:
👉 https://macedocedo.github.io/Save-Info

🚀 Tecnologias utilizadas
HTML, CSS, JavaScript
Supabase (Banco de dados + API)
🔗 Integração com Supabase

Projeto conectado ao:

👉 https://supabase.com/

🗄️ Estrutura do Banco de Dados

*📌 Tabela: posts*

create table posts (
  id text primary key,
  title text not null,
  body text,
  author text,
  category text,
  pinned boolean default false,
  media_type text,
  media_src text,
  ts bigint,
  edited_at bigint
);

📂 Tabela: categories
create table categories (
  id serial primary key,
  name text unique not null
);
📥 Dados iniciais
insert into categories (name)
values ('Geral'), ('Notícias'), ('Perguntas'), ('Projetos');
🔐 Políticas de acesso (RLS)

Para permitir uso público (necessário para GitHub Pages):

alter table posts enable row level security;
alter table categories enable row level security;

create policy "pub"
on posts for all
using (true)
with check (true);

create policy "pub"
on categories for all
using (true)
with check (true);

Resumo: create table posts (
  id text primary key, title text not null, body text, author text,
  category text, pinned boolean default false, media_type text,
  media_src text, ts bigint, edited_at bigint
);
create table categories (
  id serial primary key, name text unique not null
);
insert into categories (name) values ('Geral'),('Notícias'),('Perguntas'),('Projetos');

-- Políticas de acesso público (necessário para GitHub Pages)
alter table posts enable row level security;
alter table categories enable row level security;
create policy "pub" on posts for all using (true) with check (true);
create policy "pub" on categories for all using (true) with check (true);
