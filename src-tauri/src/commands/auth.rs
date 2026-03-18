use tauri::{AppHandle, State};

use crate::auth::manager::{AuthStatus, ConnectOptions};
use crate::state::AppState;

#[tauri::command]
pub async fn auth_connect(
    provider: String,
    options: Option<ConnectOptions>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    state
        .auth
        .connect(&provider, options, &state.db, &app)
        .await
}

#[tauri::command]
pub fn auth_disconnect(provider: String, state: State<'_, AppState>, app: AppHandle) {
    state.auth.disconnect(&provider, &state.db, &app);
}

#[tauri::command]
pub fn auth_status(state: State<'_, AppState>) -> Vec<AuthStatus> {
    state.auth.get_status(&state.db)
}
