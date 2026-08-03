-- Migration: add edge_diff_from_previous_version to asset_graph_versions
-- Adds metadata used by CognitionEngine for incremental graph diffs.

ALTER TABLE asset_graph_versions
ADD COLUMN IF NOT EXISTS edge_diff_from_previous_version JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN asset_graph_versions.edge_diff_from_previous_version IS
  'Differential metadata describing the graph changes from the prior version.';
