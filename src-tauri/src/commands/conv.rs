use std::sync::Arc;
use tauri::State;

use crate::db::conversations::{self, Conversation, Message, SearchResult};
use crate::state::AppState;

#[tauri::command]
pub fn conv_list(state: State<'_, Arc<AppState>>) -> Result<Vec<Conversation>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::list_conversations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_create(provider: String, state: State<'_, Arc<AppState>>) -> Result<Conversation, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::create_conversation(&conn, &provider, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::delete_conversation(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_get_messages(id: String, state: State<'_, Arc<AppState>>) -> Result<Vec<Message>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::get_messages(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_update_title(
    id: String,
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::update_title(&conn, &id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_toggle_pin(id: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::toggle_pin(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_delete_all(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::delete_all_conversations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn conv_export(
    id: String,
    format: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    let conv = conversations::get_conversation(&conn, &id)
        .ok_or("Conversation not found")?;
    let messages = conversations::get_messages(&conn, &id).map_err(|e| e.to_string())?;

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
        "json" => serde_json::to_string_pretty(&serde_json::json!({
            "conversation": conv,
            "messages": messages,
        }))
        .map_err(|_| "Failed to serialize conversation data".to_string()),
        _ => Err(format!("Unknown format: {format}")),
    }
}

#[tauri::command]
pub fn conv_search(
    query: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SearchResult>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    conversations::search_messages(&conn, &query).map_err(|e| e.to_string())
}
