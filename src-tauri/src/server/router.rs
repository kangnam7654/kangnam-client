use std::sync::Arc;

use axum::{routing::get, Router};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::server::ws;
use crate::state::AppState;

pub fn create_router(state: Arc<AppState>, static_dir: Option<String>) -> Router {
    let mut router = Router::new()
        .route("/ws", get(ws::ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Serve static frontend files in production
    if let Some(dir) = static_dir {
        router = router.nest_service("/", ServeDir::new(dir));
    }

    router
}
