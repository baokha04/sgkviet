-- Migration: add_html_content
-- Created at: 2026-05-02

ALTER TABLE book_page ADD COLUMN html_content TEXT;
