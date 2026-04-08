use crate::rpc::handlers;
use crate::rpc::types::{JsonRpcError, JsonRpcRequest, JsonRpcResponse};
use crate::state::AppState;

pub async fn dispatch(request: JsonRpcRequest, state: &AppState) -> JsonRpcResponse {
    let result = match request.method.as_str() {
        "cli.listProviders" => handlers::list_providers().await,
        "cli.checkInstalled" => handlers::check_installed(request.params, state).await,
        "cli.install" => handlers::install(request.params, state).await,
        "cli.startSession" => handlers::start_session(request.params, state).await,
        "cli.sendMessage" => handlers::send_message(request.params, state).await,
        "cli.permissionResponse" => handlers::permission_response(request.params, state).await,
        "cli.stopSession" => handlers::stop_session(request.params, state).await,
        _ => Err(JsonRpcError::method_not_found()),
    };

    match result {
        Ok(value) => JsonRpcResponse::success(request.id, value),
        Err(error) => JsonRpcResponse::error(request.id, error),
    }
}
