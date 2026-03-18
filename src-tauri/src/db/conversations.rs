use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub provider: String,
    pub model: Option<String>,
    pub pinned: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub tool_use_id: Option<String>,
    pub tool_name: Option<String>,
    pub tool_args: Option<String>,
    pub token_count: Option<i64>,
    pub attachments: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    #[serde(rename = "messageId")]
    pub message_id: String,
    #[serde(rename = "conversationId")]
    pub conversation_id: String,
    #[serde(rename = "conversationTitle")]
    pub conversation_title: String,
    pub content: String,
    pub role: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

pub fn list_conversations(conn: &Connection) -> Vec<Conversation> {
    let mut stmt = conn
        .prepare("SELECT id, title, provider, model, pinned, created_at, updated_at FROM conversations ORDER BY pinned DESC, updated_at DESC")
        .unwrap();
    stmt.query_map([], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            title: row.get(1)?,
            provider: row.get(2)?,
            model: row.get(3)?,
            pinned: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn create_conversation(conn: &Connection, provider: &str, model: Option<&str>) -> Conversation {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO conversations (id, provider, model, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, provider, model, now, now],
    ).unwrap();

    Conversation {
        id,
        title: "New Chat".to_string(),
        provider: provider.to_string(),
        model: model.map(|s| s.to_string()),
        pinned: 0,
        created_at: now,
        updated_at: now,
    }
}

pub fn delete_conversation(conn: &Connection, id: &str) {
    conn.execute("DELETE FROM messages WHERE conversation_id = ?1", params![id]).ok();
    conn.execute("DELETE FROM conversations WHERE id = ?1", params![id]).ok();
}

pub fn delete_all_conversations(conn: &Connection) {
    conn.execute_batch("DELETE FROM messages; DELETE FROM conversations;").ok();
}

pub fn get_conversation(conn: &Connection, id: &str) -> Option<Conversation> {
    conn.query_row(
        "SELECT id, title, provider, model, pinned, created_at, updated_at FROM conversations WHERE id = ?1",
        params![id],
        |row| Ok(Conversation {
            id: row.get(0)?,
            title: row.get(1)?,
            provider: row.get(2)?,
            model: row.get(3)?,
            pinned: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        }),
    ).ok()
}

pub fn update_title(conn: &Connection, id: &str, title: &str) {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, id],
    ).ok();
}

pub fn toggle_pin(conn: &Connection, id: &str) {
    if let Some(conv) = get_conversation(conn, id) {
        let new_pinned = if conv.pinned != 0 { 0 } else { 1 };
        conn.execute(
            "UPDATE conversations SET pinned = ?1 WHERE id = ?2",
            params![new_pinned, id],
        ).ok();
    }
}

pub fn auto_title_if_needed(conn: &Connection, conversation_id: &str, user_message: &str) {
    if let Some(conv) = get_conversation(conn, conversation_id) {
        if conv.title != "New Chat" {
            return;
        }
        let trimmed = user_message.trim();
        if trimmed.is_empty() {
            return;
        }
        let first_line = trimmed.lines().next().unwrap_or(trimmed);
        let title = if first_line.len() > 40 {
            format!("{}…", &first_line[..first_line.char_indices().nth(40).map(|(i, _)| i).unwrap_or(first_line.len())])
        } else {
            first_line.to_string()
        };
        update_title(conn, conversation_id, &title);
    }
}

pub fn get_messages(conn: &Connection, conversation_id: &str) -> Vec<Message> {
    let mut stmt = conn
        .prepare("SELECT id, conversation_id, role, content, tool_use_id, tool_name, tool_args, token_count, attachments, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC")
        .unwrap();
    stmt.query_map(params![conversation_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            tool_use_id: row.get(4)?,
            tool_name: row.get(5)?,
            tool_args: row.get(6)?,
            token_count: row.get(7)?,
            attachments: row.get(8)?,
            created_at: row.get(9)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn add_message(
    conn: &Connection,
    conversation_id: &str,
    role: &str,
    content: &str,
    tool_use_id: Option<&str>,
    token_count: Option<i64>,
    attachments: Option<&str>,
    tool_name: Option<&str>,
    tool_args: Option<&str>,
) -> Message {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, tool_use_id, tool_name, tool_args, token_count, attachments, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![id, conversation_id, role, content, tool_use_id, tool_name, tool_args, token_count, attachments, now],
    ).unwrap();

    // Update conversation timestamp
    conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, conversation_id],
    ).ok();

    Message {
        id,
        conversation_id: conversation_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        tool_use_id: tool_use_id.map(|s| s.to_string()),
        tool_name: tool_name.map(|s| s.to_string()),
        tool_args: tool_args.map(|s| s.to_string()),
        token_count,
        attachments: attachments.map(|s| s.to_string()),
        created_at: now,
    }
}

pub fn search_messages(conn: &Connection, query: &str) -> Vec<SearchResult> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return vec![];
    }
    let pattern = format!("%{trimmed}%");
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.conversation_id, c.title, m.content, m.role, m.created_at
             FROM messages m JOIN conversations c ON c.id = m.conversation_id
             WHERE m.content LIKE ?1 AND m.role IN ('user', 'assistant')
             ORDER BY m.created_at DESC LIMIT 50",
        )
        .unwrap();
    stmt.query_map(params![pattern], |row| {
        Ok(SearchResult {
            message_id: row.get(0)?,
            conversation_id: row.get(1)?,
            conversation_title: row.get(2)?,
            content: row.get(3)?,
            role: row.get(4)?,
            created_at: row.get(5)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}
