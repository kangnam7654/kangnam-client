use tauri::State;

use crate::db::conversations::{self, Conversation, Message, SearchResult};
use crate::state::AppState;

#[tauri::command]
pub fn conv_list(state: State<'_, AppState>) -> Vec<Conversation> {
    let conn = state.db.lock().unwrap();
    conversations::list_conversations(&conn)
}

#[tauri::command]
pub fn conv_create(provider: String, state: State<'_, AppState>) -> Conversation {
    let conn = state.db.lock().unwrap();
    conversations::create_conversation(&conn, &provider, None)
}

#[tauri::command]
pub fn conv_delete(id: String, state: State<'_, AppState>) {
    let conn = state.db.lock().unwrap();
    conversations::delete_conversation(&conn, &id);
}

#[tauri::command]
pub fn conv_get_messages(id: String, state: State<'_, AppState>) -> Vec<Message> {
    let conn = state.db.lock().unwrap();
    conversations::get_messages(&conn, &id)
}

#[tauri::command]
pub fn conv_update_title(id: String, title: String, state: State<'_, AppState>) {
    let conn = state.db.lock().unwrap();
    conversations::update_title(&conn, &id, &title);
}

#[tauri::command]
pub fn conv_toggle_pin(id: String, state: State<'_, AppState>) {
    let conn = state.db.lock().unwrap();
    conversations::toggle_pin(&conn, &id);
}

#[tauri::command]
pub fn conv_delete_all(state: State<'_, AppState>) {
    let conn = state.db.lock().unwrap();
    conversations::delete_all_conversations(&conn);
}

#[tauri::command]
pub fn conv_export(id: String, format: String, state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let conv = conversations::get_conversation(&conn, &id)
        .ok_or("Conversation not found")?;
    let messages = conversations::get_messages(&conn, &id);

    match format.as_str() {
        "markdown" => {
            let mut md = format!("# {}\n\n", conv.title);
            for msg in &messages {
                let role = match msg.role.as_str() {
                    "user" => "**User**",
                    "assistant" => "**Assistant**",
                    "system" => "**System**",
                    "tool" => "**Tool**",
                    _ => &msg.role,
                };
                md.push_str(&format!("{role}\n\n{}\n\n---\n\n", msg.content));
            }
            Ok(md)
        }
        "json" => {
            serde_json::to_string_pretty(&serde_json::json!({
                "conversation": conv,
                "messages": messages,
            }))
            .map_err(|e| e.to_string())
        }
        _ => Err(format!("Unknown format: {format}")),
    }
}

#[tauri::command]
pub fn conv_search(query: String, state: State<'_, AppState>) -> Vec<SearchResult> {
    let conn = state.db.lock().unwrap();
    conversations::search_messages(&conn, &query)
}
