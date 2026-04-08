pub mod broadcast;
pub mod router;
pub mod ws;

use std::sync::Arc;
use crate::state::AppState;

pub async fn start_server(state: Arc<AppState>, port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let static_dir = std::env::var("KANGNAM_STATIC_DIR").ok();
    let app = router::create_router(state, static_dir);

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    eprintln!("[server] Listening on ws://localhost:{}", port);
    axum::serve(listener, app).await?;
    Ok(())
}
