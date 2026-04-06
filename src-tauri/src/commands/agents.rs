use tauri::State;

use crate::db::agents::{self, Agent};
use crate::state::AppState;

#[tauri::command]
pub fn agents_list(state: State<'_, AppState>) -> Result<Vec<Agent>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::list_agents(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agents_get(id: String, state: State<'_, AppState>) -> Result<Option<Agent>, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    Ok(agents::get_agent(&conn, &id))
}

#[tauri::command]
pub fn agents_create(
    name: String,
    description: String,
    instructions: String,
    model: Option<String>,
    allowed_tools: Option<Vec<String>>,
    max_turns: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Agent, String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::create_agent(
        &conn,
        &name,
        &description,
        &instructions,
        model.as_deref(),
        allowed_tools,
        max_turns.unwrap_or(10),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agents_update(
    id: String,
    name: String,
    description: String,
    instructions: String,
    model: Option<String>,
    allowed_tools: Option<Vec<String>>,
    max_turns: Option<i64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::update_agent(
        &conn,
        &id,
        &name,
        &description,
        &instructions,
        model.as_deref(),
        allowed_tools,
        max_turns.unwrap_or(10),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agents_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
    agents::delete_agent(&conn, &id);
    Ok(())
}
