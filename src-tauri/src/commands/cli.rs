use tauri::{AppHandle, State};

use crate::rpc::dispatcher;
use crate::rpc::types::{JsonRpcRequest, JsonRpcResponse};
use crate::state::AppState;

#[tauri::command]
pub async fn rpc(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    request: JsonRpcRequest,
) -> Result<JsonRpcResponse, ()> {
    Ok(dispatcher::dispatch(request, state.inner(), app_handle).await)
}
