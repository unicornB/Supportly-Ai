CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_documents_ai_item_unique
  ON kb_documents(ai_search_instance_id, ai_search_item_id)
  WHERE ai_search_item_id IS NOT NULL;
