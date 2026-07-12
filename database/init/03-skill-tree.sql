-- ================================================================
-- Skill Tree schema
-- ================================================================
CREATE SCHEMA IF NOT EXISTS skill_tree;

CREATE TABLE IF NOT EXISTS skill_tree.nodes (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    icon        VARCHAR(100),
    cost        INTEGER      NOT NULL DEFAULT 1 CHECK (cost >= 0),
    pos_x       FLOAT        NOT NULL DEFAULT 0,
    pos_y       FLOAT        NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_tree.edges (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES skill_tree.nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES skill_tree.nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, target_id),
    CHECK (source_id <> target_id)
);

CREATE TABLE IF NOT EXISTS skill_tree.player_progress (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    node_id     UUID NOT NULL REFERENCES skill_tree.nodes(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_tree_edges_source   ON skill_tree.edges(source_id);
CREATE INDEX IF NOT EXISTS idx_skill_tree_edges_target   ON skill_tree.edges(target_id);
CREATE INDEX IF NOT EXISTS idx_skill_tree_progress_user  ON skill_tree.player_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_tree_progress_node  ON skill_tree.player_progress(node_id);
