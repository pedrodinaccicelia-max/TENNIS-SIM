-- =============================================================
-- Tennis Simulator — modo Trivia (aplicado em 01/11/2026)
-- Guarda o modo de jogo de cada carreira e o aproveitamento nas perguntas,
-- para a lista "Minhas carreiras" mostrar os dois modos sem abrir o estado.
-- Carreiras antigas ficam como 'full' (FULL Sim).
-- =============================================================
alter table public.careers
  add column if not exists mode text not null default 'full',
  add column if not exists accuracy real;

alter table public.careers drop constraint if exists careers_mode_check;
alter table public.careers add constraint careers_mode_check check (mode in ('full', 'trivia'));
alter table public.careers drop constraint if exists careers_accuracy_check;
alter table public.careers add constraint careers_accuracy_check check (accuracy is null or (accuracy >= 0 and accuracy <= 1));
