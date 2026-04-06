use tauri::{AppHandle, State};

use crate::cli::manager::CliManager;
use crate::cli::registry::{CliRegistry, ProviderMeta};
use crate::cli::types::CliStatus;
use crate::state::AppState;

#[tauri::command]
pub async fn cli_list_providers() -> Result<Vec<ProviderMeta>, String> {
    Ok(CliRegistry::known_providers())
}

#[tauri::command]
pub async fn cli_check_installed(
    state: State<'_, AppState>,
    provider: String,
) -> Result<CliStatus, String> {
    let manager = state.cli_manager.lock().await;
    manager.check_installed(&provider).await
}

#[tauri::command]
pub async fn cli_install(state: State<'_, AppState>, provider: String) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager.install_cli(&provider).await
}

#[tauri::command]
pub async fn cli_start_session(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    provider: String,
    working_dir: String,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let working_dir = std::path::PathBuf::from(&working_dir);

    if !working_dir.is_dir() {
        return Err(format!(
            "Directory does not exist: {}",
            working_dir.display()
        ));
    }

    let manager = state.cli_manager.lock().await;
    manager
        .start_session(&provider, &working_dir, &session_id, app_handle)
        .await?;

    Ok(session_id)
}

#[tauri::command]
pub async fn cli_send_message(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    session_id: String,
    message: String,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager.send_message(&session_id, &message, app_handle).await
}

#[tauri::command]
pub async fn cli_send_permission(
    state: State<'_, AppState>,
    session_id: String,
    request_id: String,
    allowed: bool,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager
        .send_permission_response(&session_id, &request_id, allowed)
        .await
}

#[tauri::command]
pub async fn cli_stop_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let manager = state.cli_manager.lock().await;
    manager.stop_session(&session_id).await
}
