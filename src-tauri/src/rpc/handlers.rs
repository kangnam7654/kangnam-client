use serde::Deserialize;
use std::path::PathBuf;

use crate::cli::registry::CliRegistry;
use crate::db::conversations;
use crate::rpc::types::JsonRpcError;
use crate::state::AppState;
use chrono;
use rusqlite;

type RpcResult = Result<serde_json::Value, JsonRpcError>;

pub async fn list_providers() -> RpcResult {
    let providers = CliRegistry::known_providers();
    Ok(serde_json::to_value(providers).map_err(|e| JsonRpcError::internal(&e.to_string()))?)
}

pub async fn check_installed(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: ProviderParam = parse_params(params)?;
    let manager = state.cli_manager.lock().await;
    let status = manager
        .check_installed(&p.provider)
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
    Ok(serde_json::to_value(status).map_err(|e| JsonRpcError::internal(&e.to_string()))?)
}

pub async fn install(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: ProviderParam = parse_params(params)?;
    let manager = state.cli_manager.lock().await;
    manager
        .install_cli(&p.provider)
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
    Ok(serde_json::Value::Null)
}

pub async fn start_session(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: StartSessionParams = parse_params(params)?;

    let working_dir = match p.working_dir {
        Some(ref dir) => {
            let path = PathBuf::from(dir);
            if !path.is_dir() {
                return Err(JsonRpcError::dir_not_found(dir));
            }
            path
        }
        None => dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp")),
    };

    let session_id = uuid::Uuid::new_v4().to_string();

    // Create conversation in DB using session_id as conversation id
    {
        let db = state.db.lock().map_err(|e| JsonRpcError::internal(&e.to_string()))?;
        let now = chrono::Utc::now().timestamp();
        db.execute(
            "INSERT INTO conversations (id, title, cli_provider, created_at, updated_at) \
             VALUES (?1, 'New Chat', ?2, ?3, ?4)",
            rusqlite::params![session_id, p.provider, now, now],
        ).map_err(|e| JsonRpcError::internal(&e.to_string()))?;
    }

    let broadcast_tx = state.broadcast_tx.clone();
    let enhanced_tx = state.enhanced_broadcast_tx.clone();
    let manager = state.cli_manager.lock().await;
    manager
        .start_session(&p.provider, &working_dir, &session_id, broadcast_tx, Some(enhanced_tx))
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;

    Ok(serde_json::Value::String(session_id))
}

pub async fn send_message(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: SendMessageParams = parse_params(params)?;

    // Save user message to DB
    {
        let db = state.db.lock().map_err(|e| JsonRpcError::internal(&e.to_string()))?;
        let _ = conversations::add_message(
            &db, &p.session_id, "user", &p.message,
            None, None, None, None, None,
        );
        let _ = conversations::auto_title_if_needed(&db, &p.session_id, &p.message);
    }

    let broadcast_tx = state.broadcast_tx.clone();
    let manager = state.cli_manager.lock().await;
    manager
        .send_message(&p.session_id, &p.message, broadcast_tx)
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
    Ok(serde_json::Value::Null)
}

pub async fn send_permission(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: SendPermissionParams = parse_params(params)?;
    let manager = state.cli_manager.lock().await;
    manager
        .send_permission_response(&p.session_id, &p.request_id, p.allowed)
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
    Ok(serde_json::Value::Null)
}

pub async fn stop_session(params: Option<serde_json::Value>, state: &AppState) -> RpcResult {
    let p: SessionParam = parse_params(params)?;
    let manager = state.cli_manager.lock().await;
    manager
        .stop_session(&p.session_id)
        .await
        .map_err(|e| JsonRpcError::internal(&e))?;
    Ok(serde_json::Value::Null)
}

// -- Param types --

#[derive(Deserialize)]
struct ProviderParam {
    provider: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartSessionParams {
    provider: String,
    working_dir: Option<String>, // Optional — None = chat mode (no directory)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageParams {
    session_id: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendPermissionParams {
    session_id: String,
    request_id: String,
    allowed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionParam {
    session_id: String,
}

fn parse_params<T: serde::de::DeserializeOwned>(
    params: Option<serde_json::Value>,
) -> Result<T, JsonRpcError> {
    let value = params.unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
    serde_json::from_value(value).map_err(|e| JsonRpcError::invalid_params(&e.to_string()))
}
