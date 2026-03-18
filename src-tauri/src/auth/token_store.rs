use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub metadata: Option<serde_json::Value>,
}

/// Save a token to the database.
/// Unlike Electron's safeStorage, we store tokens in plaintext in SQLite
/// (keyring crate is used separately for high-value secrets if needed).
/// The DB file is in the user's private app data directory.
pub fn save_token(conn: &Connection, token: &StoredToken) {
    let metadata_str = token.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());
    conn.execute(
        "INSERT OR REPLACE INTO auth_tokens (provider, access_token, refresh_token, expires_at, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![token.provider, token.access_token, token.refresh_token, token.expires_at, metadata_str],
    ).ok();
}

/// Get a token for the given provider.
pub fn get_token(conn: &Connection, provider: &str) -> Option<StoredToken> {
    conn.query_row(
        "SELECT provider, access_token, refresh_token, expires_at, metadata FROM auth_tokens WHERE provider = ?1",
        params![provider],
        |row| {
            let metadata_str: Option<String> = row.get(4)?;
            let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());
            Ok(StoredToken {
                provider: row.get(0)?,
                access_token: row.get(1)?,
                refresh_token: row.get(2)?,
                expires_at: row.get(3)?,
                metadata,
            })
        },
    ).ok()
}

/// Delete a token for the given provider.
pub fn delete_token(conn: &Connection, provider: &str) {
    conn.execute("DELETE FROM auth_tokens WHERE provider = ?1", params![provider]).ok();
}

/// List all providers that have stored tokens.
pub fn list_token_providers(conn: &Connection) -> Vec<String> {
    let mut stmt = conn.prepare("SELECT provider FROM auth_tokens").unwrap();
    let providers = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    providers
}
