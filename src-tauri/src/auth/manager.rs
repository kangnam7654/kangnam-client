use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

use super::credentials::*;
use super::oauth_server::{start_dynamic_oauth_server, wait_for_oauth_callback};
use super::pkce::{generate_pkce, generate_state};
use super::token_store::{self, StoredToken};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    pub provider: String,
    pub connected: bool,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectOptions {
    #[serde(rename = "setupToken")]
    pub setup_token: Option<String>,
}

pub struct AuthManager {
    http: reqwest::Client,
}

impl AuthManager {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
        }
    }

    pub async fn connect(
        &self,
        provider: &str,
        options: Option<ConnectOptions>,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Result<(), String> {
        match provider {
            "codex" => self.start_codex_oauth(db, app).await,
            "gemini" => self.start_gemini_oauth(db, app).await,
            "antigravity" => self.start_antigravity_oauth(db, app).await,
            "copilot" => self.start_copilot_device_flow(db, app).await,
            "claude" => {
                let setup_token = options.and_then(|o| o.setup_token);
                self.save_claude_setup_token(setup_token, db, app).await
            }
            _ => Err(format!("Unknown provider: {provider}")),
        }
    }

    pub fn disconnect(&self, provider: &str, db: &Mutex<Connection>, app: &AppHandle) {
        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::delete_token(&conn, provider);
        let _ = app.emit("auth:on-disconnected", provider);
    }

    pub fn get_status(&self, db: &Mutex<Connection>) -> Vec<AuthStatus> {
        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        let providers = ["codex", "gemini", "antigravity", "copilot", "claude"];
        let connected = token_store::list_token_providers(&conn);

        providers
            .iter()
            .map(|&p| {
                let token = if connected.contains(&p.to_string()) {
                    token_store::get_token(&conn, p)
                } else {
                    None
                };
                AuthStatus {
                    provider: p.to_string(),
                    connected: token.is_some(),
                    expires_at: token.and_then(|t| t.expires_at),
                }
            })
            .collect()
    }

    /// Get a valid access token, auto-refreshing if expired.
    pub async fn get_access_token(
        &self,
        provider: &str,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Option<String> {
        let token = {
            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            token_store::get_token(&conn, provider)?
        };

        let now = chrono::Utc::now().timestamp();

        // Check if token expires within 5 minutes
        if let Some(expires_at) = token.expires_at {
            if now > expires_at - 300 {
                // Claude OAT refresh
                if provider == "claude" && token.access_token.starts_with("sk-ant-oat") {
                    if let Some(refreshed) = self
                        .refresh_claude_oauth_token(token.refresh_token.as_deref(), db)
                        .await
                    {
                        return Some(refreshed);
                    }
                }

                // Standard refresh
                if let Ok(refreshed) = self
                    .refresh_token(provider, token.refresh_token.as_deref(), db)
                    .await
                {
                    return Some(refreshed);
                }

                // If refresh failed but token hasn't fully expired, try it anyway
                if now <= expires_at {
                    return Some(token.access_token);
                }
                return None;
            }
        }

        Some(token.access_token)
    }

    // ==============================
    // Codex OAuth (PKCE, no secret)
    // ==============================

    async fn start_codex_oauth(
        &self,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Result<(), String> {
        let pkce = generate_pkce();
        let state = generate_state();
        let port = CODEX.redirect_port.unwrap();
        let redirect_uri = format!("http://localhost:{port}{}", CODEX.redirect_path);

        let auth_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            CODEX.auth_url.unwrap(),
            urlencoding::encode(CODEX.client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(CODEX.scopes),
            &state,
            &pkce.code_challenge
        );

        // Spawn blocking listener before opening browser
        let expected_path = CODEX.redirect_path.to_string();
        let callback_handle =
            tokio::task::spawn_blocking(move || wait_for_oauth_callback(port, &expected_path));

        open::that(&auth_url).map_err(|e| format!("Failed to open browser: {e}"))?;

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(120),
            callback_handle,
        )
        .await
        .map_err(|_| "OAuth login timed out after 120 seconds. Please try again.".to_string())?
        .map_err(|e| format!("Callback task failed: {e}"))??;

        if result.state != state {
            return Err("OAuth state mismatch — possible CSRF attack".to_string());
        }

        // Exchange code for tokens
        let token_resp = self
            .http
            .post(CODEX.token_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=authorization_code&client_id={}&code={}&redirect_uri={}&code_verifier={}",
                CODEX.client_id, result.code, urlencoding::encode(&redirect_uri), pkce.code_verifier
            ))
            .send()
            .await
            .map_err(|e| format!("Token request failed: {e}"))?;

        if !token_resp.status().is_success() {
            let status = token_resp.status();
            return Err(format!("Codex token exchange failed (HTTP {})", status));
        }

        let tokens: TokenResponse = token_resp.json().await.map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "codex".to_string(),
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_in.map(|e| now + e),
                metadata: None,
            },
        );

        let _ = app.emit("auth:on-connected", "codex");
        Ok(())
    }

    // ==============================
    // Gemini OAuth (PKCE + secret, dynamic port)
    // ==============================

    async fn start_gemini_oauth(
        &self,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Result<(), String> {
        let pkce = generate_pkce();
        let state = generate_state();

        let expected_path = GEMINI.redirect_path.to_string();
        let (port, receiver) = start_dynamic_oauth_server(&expected_path)?;
        let redirect_uri = format!("http://127.0.0.1:{port}{}", GEMINI.redirect_path);

        let auth_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256",
            GEMINI.auth_url.unwrap(),
            urlencoding::encode(GEMINI.client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(GEMINI.scopes),
            &state,
            &pkce.code_challenge
        );

        let callback_handle = tokio::task::spawn_blocking(move || receiver.wait());

        open::that(&auth_url).map_err(|e| format!("Failed to open browser: {e}"))?;

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(120),
            callback_handle,
        )
        .await
        .map_err(|_| "OAuth login timed out after 120 seconds. Please try again.".to_string())?
        .map_err(|e| format!("Callback task failed: {e}"))??;

        if result.state != state {
            return Err("OAuth state mismatch".to_string());
        }

        let token_resp = self
            .http
            .post(GEMINI.token_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=authorization_code&client_id={}&client_secret={}&code={}&redirect_uri={}&code_verifier={}",
                GEMINI.client_id,
                GEMINI.client_secret.ok_or("Gemini OAuth not available (missing client secret)")?,
                result.code,
                urlencoding::encode(&redirect_uri),
                pkce.code_verifier
            ))
            .send()
            .await
            .map_err(|e| format!("Token request failed: {e}"))?;

        if !token_resp.status().is_success() {
            let status = token_resp.status();
            return Err(format!("Gemini token exchange failed (HTTP {})", status));
        }

        let tokens: TokenResponse = token_resp.json().await.map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "gemini".to_string(),
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_in.map(|e| now + e),
                metadata: Some(serde_json::json!({ "redirect_uri": redirect_uri })),
            },
        );

        let _ = app.emit("auth:on-connected", "gemini");
        Ok(())
    }

    // ==============================
    // Antigravity OAuth (PKCE + secret, fixed port)
    // ==============================

    async fn start_antigravity_oauth(
        &self,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Result<(), String> {
        let pkce = generate_pkce();
        let state = generate_state();
        let port = ANTIGRAVITY.redirect_port.unwrap();
        let redirect_uri = format!("http://localhost:{port}{}", ANTIGRAVITY.redirect_path);

        let expected_path = ANTIGRAVITY.redirect_path.to_string();
        let callback_handle =
            tokio::task::spawn_blocking(move || wait_for_oauth_callback(port, &expected_path));

        let auth_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256",
            ANTIGRAVITY.auth_url.unwrap(),
            urlencoding::encode(ANTIGRAVITY.client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(ANTIGRAVITY.scopes),
            &state,
            &pkce.code_challenge
        );

        open::that(&auth_url).map_err(|e| format!("Failed to open browser: {e}"))?;

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(120),
            callback_handle,
        )
        .await
        .map_err(|_| "OAuth login timed out after 120 seconds. Please try again.".to_string())?
        .map_err(|e| format!("Callback task failed: {e}"))??;

        if result.state != state {
            return Err("OAuth state mismatch".to_string());
        }

        let token_resp = self
            .http
            .post(ANTIGRAVITY.token_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=authorization_code&client_id={}&client_secret={}&code={}&redirect_uri={}&code_verifier={}",
                ANTIGRAVITY.client_id,
                ANTIGRAVITY.client_secret.ok_or("Antigravity OAuth not available (missing client secret)")?,
                result.code,
                urlencoding::encode(&redirect_uri),
                pkce.code_verifier
            ))
            .send()
            .await
            .map_err(|e| format!("Token request failed: {e}"))?;

        if !token_resp.status().is_success() {
            let status = token_resp.status();
            return Err(format!("Antigravity token exchange failed (HTTP {})", status));
        }

        let tokens: TokenResponse = token_resp.json().await.map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "antigravity".to_string(),
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_in.map(|e| now + e),
                metadata: None,
            },
        );

        let _ = app.emit("auth:on-connected", "antigravity");
        Ok(())
    }

    // ==============================
    // GitHub Copilot (Device Flow)
    // ==============================

    async fn start_copilot_device_flow(
        &self,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Result<(), String> {
        // Step 1: Request device code
        let resp = self
            .http
            .post(COPILOT.device_code_url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&serde_json::json!({
                "client_id": COPILOT.client_id,
                "scope": COPILOT.scope
            }))
            .send()
            .await
            .map_err(|e| format!("Device code request failed: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("Copilot device code request failed: {}", resp.status()));
        }

        let data: DeviceCodeResponse = resp.json().await.map_err(|e| e.to_string())?;

        // Send user_code to renderer for display
        let _ = app.emit(
            "auth:copilot-device-code",
            serde_json::json!({
                "userCode": data.user_code,
                "verificationUri": data.verification_uri
            }),
        );

        // Open browser
        open::that(&data.verification_uri).ok();

        // Step 2: Poll for completion
        let github_token = self
            .poll_copilot_token(&data.device_code, data.interval, data.expires_in)
            .await?;

        // Step 3: Exchange for Copilot token
        let copilot_token = self.exchange_copilot_token(&github_token).await?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "copilot".to_string(),
                access_token: copilot_token,
                refresh_token: Some(github_token),
                expires_at: Some(now + 1500), // ~25 min
                metadata: None,
            },
        );

        let _ = app.emit("auth:on-connected", "copilot");
        Ok(())
    }

    async fn poll_copilot_token(
        &self,
        device_code: &str,
        interval: u64,
        expires_in: u64,
    ) -> Result<String, String> {
        let deadline = chrono::Utc::now().timestamp() + expires_in as i64;
        let mut wait_secs = interval;

        loop {
            if chrono::Utc::now().timestamp() >= deadline {
                return Err("Copilot device flow timed out".to_string());
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;

            let resp = self
                .http
                .post(COPILOT.token_url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .json(&serde_json::json!({
                    "client_id": COPILOT.client_id,
                    "device_code": device_code,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
                }))
                .send()
                .await
                .map_err(|e| format!("Poll failed: {e}"))?;

            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

            if let Some(token) = data.get("access_token").and_then(|v| v.as_str()) {
                return Ok(token.to_string());
            }

            match data.get("error").and_then(|v| v.as_str()) {
                Some("authorization_pending") => continue,
                Some("slow_down") => {
                    wait_secs = interval + 5;
                    continue;
                }
                Some(err) => return Err(format!("Copilot auth error: {err}")),
                None => return Err("Unexpected response from Copilot".to_string()),
            }
        }
    }

    async fn exchange_copilot_token(&self, github_token: &str) -> Result<String, String> {
        let resp = self
            .http
            .get(COPILOT.copilot_token_url)
            .header("Authorization", format!("token {github_token}"))
            .header("Accept", "application/json")
            .header("Editor-Version", "vscode/1.85.1")
            .header("Editor-Plugin-Version", "copilot/1.155.0")
            .send()
            .await
            .map_err(|e| format!("Copilot token exchange failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            return Err(format!("Copilot token exchange failed (HTTP {})", status));
        }

        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        data.get("token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or("Missing token in Copilot response".to_string())
    }

    // ==============================
    // Claude (setup token / keychain)
    // ==============================

    async fn save_claude_setup_token(
        &self,
        raw_token: Option<String>,
        db: &Mutex<Connection>,
        app: &AppHandle,
    ) -> Result<(), String> {
        let (token, expires_at, refresh_token, _auth_method) = match raw_token {
            Some(ref t) if !t.trim().is_empty() => {
                let normalized = Self::normalize_claude_token(t)?;
                let method = if normalized.starts_with("sk-ant-oat") {
                    "setup-token"
                } else {
                    "api-key"
                };
                (normalized, None, None, method.to_string())
            }
            _ => {
                // Try to read from Claude Code keychain
                let keychain = Self::read_claude_code_keychain()
                    .ok_or("No token provided and Claude Code credentials not found in keychain")?;
                (
                    keychain.access_token,
                    keychain.expires_at,
                    keychain.refresh_token,
                    "keychain".to_string(),
                )
            }
        };

        // Verify token
        self.verify_claude_token(&token).await?;

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "claude".to_string(),
                access_token: token,
                refresh_token,
                expires_at,
                metadata: Some(serde_json::json!({ "authMethod": _auth_method })),
            },
        );

        let _ = app.emit("auth:on-connected", "claude");
        Ok(())
    }

    /// Read Claude Code OAuth credentials from macOS Keychain.
    fn read_claude_code_keychain() -> Option<KeychainCredentials> {
        #[cfg(not(target_os = "macos"))]
        {
            return None;
        }

        #[cfg(target_os = "macos")]
        {
            let output = Command::new("security")
                .args(["find-generic-password", "-s", "Claude Code-credentials", "-w"])
                .output()
                .ok()?;

            if !output.status.success() {
                return None;
            }

            let raw = String::from_utf8(output.stdout).ok()?;
            let parsed: serde_json::Value = serde_json::from_str(raw.trim()).ok()?;
            let oauth = parsed.get("claudeAiOauth")?.as_object()?;

            let access_token = oauth.get("accessToken")?.as_str()?.to_string();
            if access_token.trim().is_empty() {
                return None;
            }

            let expires_at = oauth
                .get("expiresAt")
                .and_then(|v| v.as_i64())
                .map(|ms| ms / 1000); // ms → seconds
            let refresh_token = oauth
                .get("refreshToken")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            Some(KeychainCredentials {
                access_token,
                refresh_token,
                expires_at,
            })
        }
    }

    async fn refresh_claude_oauth_token(
        &self,
        refresh_token: Option<&str>,
        db: &Mutex<Connection>,
    ) -> Option<String> {
        // Method 1: Use refresh token with OAuth endpoint
        if let Some(rt) = refresh_token {
            if rt.starts_with("sk-ant-ort") {
                let resp = self
                    .http
                    .post(CLAUDE_OAUTH.token_url)
                    .header("content-type", "application/json")
                    .json(&serde_json::json!({
                        "grant_type": "refresh_token",
                        "refresh_token": rt,
                        "client_id": CLAUDE_OAUTH.client_id
                    }))
                    .send()
                    .await
                    .ok()?;

                if resp.status().is_success() {
                    let data: TokenResponse = resp.json().await.ok()?;
                    let now = chrono::Utc::now().timestamp();
                    let conn = db.lock().unwrap_or_else(|e| e.into_inner());
                    token_store::save_token(
                        &conn,
                        &StoredToken {
                            provider: "claude".to_string(),
                            access_token: data.access_token.clone(),
                            refresh_token: data.refresh_token.or_else(|| Some(rt.to_string())),
                            expires_at: data.expires_in.map(|e| now + e),
                            metadata: Some(serde_json::json!({ "authMethod": "oauth-refresh" })),
                        },
                    );
                    return Some(data.access_token);
                }
            }
        }

        // Method 2: Fallback to keychain
        if let Some(keychain) = Self::read_claude_code_keychain() {
            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            token_store::save_token(
                &conn,
                &StoredToken {
                    provider: "claude".to_string(),
                    access_token: keychain.access_token.clone(),
                    refresh_token: keychain.refresh_token,
                    expires_at: keychain.expires_at,
                    metadata: Some(serde_json::json!({ "authMethod": "keychain" })),
                },
            );
            return Some(keychain.access_token);
        }

        None
    }

    async fn verify_claude_token(&self, token: &str) -> Result<(), String> {
        let is_oat = token.starts_with("sk-ant-oat");
        let mut builder = self
            .http
            .post("https://api.anthropic.com/v1/messages")
            .header("content-type", "application/json")
            .header("anthropic-version", "2023-06-01");

        if is_oat {
            builder = builder
                .header("Authorization", format!("Bearer {token}"))
                .header("anthropic-beta", "claude-code-20250219,oauth-2025-04-20");
        } else {
            builder = builder.header("x-api-key", token);
        }

        let resp = builder
            .json(&serde_json::json!({
                "model": "claude-haiku-4-5",
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "hi"}]
            }))
            .send()
            .await
            .map_err(|e| format!("Token verification failed: {e}"))?;

        match resp.status().as_u16() {
            401 => {
                Err("Invalid token — 401 Unauthorized. Please re-authenticate.".to_string())
            }
            403 => Err("Token forbidden — 403. This token may not have API access.".to_string()),
            400 => {
                Err("Token rejected (400). It may be expired. Please re-authenticate.".to_string())
            }
            s if s >= 500 => Err(format!("Anthropic API error {s}. Try again later.")),
            _ => Ok(()), // 200 or other success codes
        }
    }

    fn normalize_claude_token(raw: &str) -> Result<String, String> {
        let token = raw.trim();
        if token.is_empty() {
            return Err(
                "API key is required. Get one at console.anthropic.com/settings/keys".to_string(),
            );
        }
        if !token.starts_with("sk-ant-") {
            return Err(
                "API key must start with `sk-ant-`. Get one at console.anthropic.com".to_string(),
            );
        }
        if token.len() < 24 {
            return Err("Token looks too short.".to_string());
        }
        Ok(token.to_string())
    }

    // ==============================
    // Token Refresh
    // ==============================

    async fn refresh_token(
        &self,
        provider: &str,
        refresh_token: Option<&str>,
        db: &Mutex<Connection>,
    ) -> Result<String, String> {
        let rt = refresh_token.ok_or("No refresh token available")?;

        match provider {
            "codex" => self.refresh_codex_token(rt, db).await,
            "gemini" => {
                self.refresh_google_token(
                    "gemini",
                    GEMINI.client_id,
                    GEMINI.client_secret.ok_or("Gemini OAuth not available (missing client secret)")?,
                    rt,
                    db,
                )
                .await
            }
            "antigravity" => {
                self.refresh_google_token(
                    "antigravity",
                    ANTIGRAVITY.client_id,
                    ANTIGRAVITY.client_secret.ok_or("Antigravity OAuth not available (missing client secret)")?,
                    rt,
                    db,
                )
                .await
            }
            "copilot" => self.refresh_copilot_token(rt, db).await,
            _ => Err(format!("Cannot refresh {provider} token")),
        }
    }

    async fn refresh_codex_token(
        &self,
        refresh_token: &str,
        db: &Mutex<Connection>,
    ) -> Result<String, String> {
        let resp = self
            .http
            .post(CODEX.token_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=refresh_token&client_id={}&refresh_token={}",
                CODEX.client_id, refresh_token
            ))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("Codex token refresh failed: {}", resp.status()));
        }

        let tokens: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "codex".to_string(),
                access_token: tokens.access_token.clone(),
                refresh_token: tokens
                    .refresh_token
                    .or_else(|| Some(refresh_token.to_string())),
                expires_at: tokens.expires_in.map(|e| now + e),
                metadata: None,
            },
        );

        Ok(tokens.access_token)
    }

    async fn refresh_google_token(
        &self,
        provider: &str,
        client_id: &str,
        client_secret: &str,
        refresh_token: &str,
        db: &Mutex<Connection>,
    ) -> Result<String, String> {
        let resp = self
            .http
            .post("https://oauth2.googleapis.com/token")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=refresh_token&client_id={}&client_secret={}&refresh_token={}",
                client_id, client_secret, refresh_token
            ))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("{provider} token refresh failed: {}", resp.status()));
        }

        let tokens: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: provider.to_string(),
                access_token: tokens.access_token.clone(),
                refresh_token: Some(refresh_token.to_string()), // Google doesn't rotate refresh tokens
                expires_at: tokens.expires_in.map(|e| now + e),
                metadata: None,
            },
        );

        Ok(tokens.access_token)
    }

    async fn refresh_copilot_token(
        &self,
        github_token: &str,
        db: &Mutex<Connection>,
    ) -> Result<String, String> {
        let copilot_token = self.exchange_copilot_token(github_token).await?;
        let now = chrono::Utc::now().timestamp();

        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        token_store::save_token(
            &conn,
            &StoredToken {
                provider: "copilot".to_string(),
                access_token: copilot_token.clone(),
                refresh_token: Some(github_token.to_string()),
                expires_at: Some(now + 1500),
                metadata: None,
            },
        );

        Ok(copilot_token)
    }
}

// ── Helper types ──

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

struct KeychainCredentials {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: Option<i64>,
}
