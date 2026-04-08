use std::sync::Mutex;
use rusqlite::Connection;

use crate::cli::manager::CliManager;
use crate::db;
use crate::mcp::bridge::McpBridge;
use crate::server::broadcast::{self, BroadcastTx, EnhancedBroadcastTx};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub cli_manager: tokio::sync::Mutex<CliManager>,
    pub mcp: McpBridge,
    pub broadcast_tx: BroadcastTx,
    pub enhanced_broadcast_tx: EnhancedBroadcastTx,
}

impl AppState {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let data_dir = get_data_dir()?;
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("kangnam-client.db");
        let mut conn = db::connection::open_database(&db_path)?;
        db::schema::run_migrations(&mut conn)?;

        let mut cli_manager = CliManager::new();
        cli_manager.register_adapter(Box::new(
            crate::cli::adapters::claude::ClaudeAdapter::new(),
        ));
        cli_manager.register_adapter(Box::new(
            crate::cli::adapters::codex::CodexAdapter::new(),
        ));

        let (broadcast_tx, _) = broadcast::create_channel();
        let (enhanced_broadcast_tx, _) = broadcast::create_enhanced_channel();

        Ok(Self {
            db: Mutex::new(conn),
            cli_manager: tokio::sync::Mutex::new(cli_manager),
            mcp: McpBridge::new(),
            broadcast_tx,
            enhanced_broadcast_tx,
        })
    }
}

fn get_data_dir() -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    let app_dir = get_app_data_dir().ok_or("Could not determine app data directory")?;
    Ok(app_dir.join("data"))
}

fn get_app_data_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "macos")]
    {
        dirs::config_dir().map(|p| p.join("kangnam-client"))
    }
    #[cfg(target_os = "windows")]
    {
        dirs::data_dir().map(|p| p.join("kangnam-client"))
    }
    #[cfg(target_os = "linux")]
    {
        dirs::config_dir().map(|p| p.join("kangnam-client"))
    }
}
