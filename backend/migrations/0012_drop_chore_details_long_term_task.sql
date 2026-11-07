-- Migration number: 0012 	 2026-11-07T18:24:18.161Z
-- Phase 2 of F7 (#81): the list-polish bundle (#118) stopped reading and writing these columns.
ALTER TABLE chores DROP COLUMN details;
ALTER TABLE chores DROP COLUMN long_term_task;
