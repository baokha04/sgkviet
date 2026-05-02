-- Migration: add_total_pages
-- Created at: 2026-05-01

ALTER TABLE book ADD COLUMN total_pages INTEGER DEFAULT 0;
