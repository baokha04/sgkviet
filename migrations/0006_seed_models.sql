-- Migration: seed_models
-- Created at: 2026-05-09

INSERT INTO config (key, value)
SELECT 'AI_MODEL', 'google-ai-studio/gemini-2.5-flash'
WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'AI_MODEL');

INSERT INTO config (key, value)
SELECT 'CF_AI_MODEL', '@cf/meta/llama-3-8b-instruct'
WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'CF_AI_MODEL');

INSERT INTO config (key, value)
SELECT 'EMBEDDING_MODEL', '@cf/baai/bge-base-en-v1.5'
WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'EMBEDDING_MODEL');
