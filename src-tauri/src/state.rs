use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::auth::manager::AuthManager;
use crate::db;
use crate::mcp::bridge::McpBridge;
use crate::providers::router::LLMRouter;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub auth: AuthManager,
    pub router: LLMRouter,
    pub mcp: McpBridge,
}

impl AppState {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let data_dir = Self::get_data_dir()?;
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("kangnam-client.db");
        let mut conn = db::connection::open_database(&db_path)?;

        db::schema::run_migrations(&mut conn)?;

        Ok(Self {
            db: Mutex::new(conn),
            data_dir,
            auth: AuthManager::new(),
            router: LLMRouter::new(),
            mcp: McpBridge::new(),
        })
    }

    fn get_data_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let app_dir = get_app_data_dir().ok_or("Could not determine app data directory")?;
        Ok(app_dir.join("data"))
    }
}

fn get_app_data_dir() -> Option<PathBuf> {
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
