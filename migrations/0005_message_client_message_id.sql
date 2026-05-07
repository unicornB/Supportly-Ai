ALTER TABLE messages ADD COLUMN client_message_id TEXT;

CREATE UNIQUE INDEX idx_messages_client_message
  ON messages(conversation_id, sender_type, sender_admin_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

