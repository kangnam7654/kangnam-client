use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "kangnam-client";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub metadata: Option<serde_json::Value>,
}

/// Save a token — refresh_token goes to OS keychain, rest to SQLite.
pub fn save_token(conn: &Connection, token: &StoredToken) {
    // Store refresh_token in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
    if let Some(ref rt) = token.refresh_token {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", token.provider)) {
            let _ = entry.set_password(rt);
        }
    }

    // Store access_token + metadata in SQLite (short-lived, acceptable in plaintext)
    let metadata_str = token.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());
    conn.execute(
        "INSERT OR REPLACE INTO auth_tokens (provider, access_token, refresh_token, expires_at, metadata) VALUES (?1, ?2, NULL, ?3, ?4)",
        params![token.provider, token.access_token, token.expires_at, metadata_str],
    ).ok();
}

/// Get a token — reads refresh_token from OS keychain, rest from SQLite.
pub fn get_token(conn: &Connection, provider: &str) -> Option<StoredToken> {
    let mut token = conn.query_row(
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
    ).ok()?;

    // Retrieve refresh_token from OS keychain
    if token.refresh_token.is_none() {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", provider)) {
            if let Ok(rt) = entry.get_password() {
                token.refresh_token = Some(rt);
            }
        }
    }

    Some(token)
}

/// Delete a token from both SQLite and OS keychain.
pub fn delete_token(conn: &Connection, provider: &str) {
    conn.execute("DELETE FROM auth_tokens WHERE provider = ?1", params![provider]).ok();

    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", provider)) {
        let _ = entry.delete_credential();
    }
}

/// List all providers that have stored tokens.
pub fn list_token_providers(conn: &Connection) -> Vec<String> {
    let Ok(mut stmt) = conn.prepare("SELECT provider FROM auth_tokens") else {
        return vec![];
    };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) else {
        return vec![];
    };
    rows.filter_map(|r| r.ok()).collect()
}
