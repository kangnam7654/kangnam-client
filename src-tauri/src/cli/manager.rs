use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

use crate::cli::adapter::CliAdapter;
use crate::cli::types::{CliStatus, UnifiedMessage};
use crate::rpc::types::JsonRpcNotification;

struct CliSession {
    child: Child,
    provider: String,
    working_dir: PathBuf,
    session_id: String,
}

pub struct CliManager {
    adapters: HashMap<String, Box<dyn CliAdapter>>,
    sessions: Arc<Mutex<HashMap<String, CliSession>>>,
}

impl CliManager {
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register_adapter(&mut self, adapter: Box<dyn CliAdapter>) {
        let name = adapter.name().to_string();
        self.adapters.insert(name, adapter);
    }

    fn get_adapter(&self, provider: &str) -> Result<&dyn CliAdapter, String> {
        self.adapters
            .get(provider)
            .map(|a| a.as_ref())
            .ok_or_else(|| format!("Unknown provider: {}", provider))
    }

    /// Start a new CLI session. Spawns the subprocess and begins reading stdout.
    pub async fn start_session(
        &self,
        provider: &str,
        working_dir: &Path,
        session_id: &str,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let adapter = self.get_adapter(provider)?;
        let mut cmd = adapter.build_command(working_dir);
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", provider, e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let sessions = self.sessions.clone();
        let sid = session_id.to_string();
        let is_claude = provider == "claude";

        {
            let mut sessions_lock = sessions.lock().await;
            sessions_lock.insert(
                session_id.to_string(),
                CliSession {
                    child,
                    provider: provider.to_string(),
                    working_dir: working_dir.to_path_buf(),
                    session_id: session_id.to_string(),
                },
            );
        }

        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let parsed = if is_claude {
                    crate::cli::adapters::claude::ClaudeAdapter::new().parse_line(&line)
                } else {
                    crate::cli::adapters::codex::CodexAdapter::new().parse_line(&line)
                };

                match parsed {
                    Ok(Some(msg)) => {
                        let notification = JsonRpcNotification::new(
                            "cli.stream",
                            serde_json::to_value(&msg).unwrap_or_default(),
                        );
                        let _ = app_handle.emit("rpc-notification", &notification);
                    }
                    Ok(None) => {}
                    Err(e) => {
                        let err_notification = JsonRpcNotification::new(
                            "cli.stream",
                            serde_json::to_value(&UnifiedMessage::Error {
                                message: format!("Parse error: {}", e),
                            }).unwrap_or_default(),
                        );
                        let _ = app_handle.emit("rpc-notification", &err_notification);
                    }
                }
            }

            let turn_end = JsonRpcNotification::new(
                "cli.stream",
                serde_json::to_value(&UnifiedMessage::TurnEnd { usage: None }).unwrap_or_default(),
            );
            let _ = app_handle.emit("rpc-notification", &turn_end);

            let mut sessions_lock = sessions.lock().await;
            sessions_lock.remove(&sid);
        });

        Ok(())
    }

    /// Send a message to a running CLI session (via stdin).
    /// For Codex (non-persistent), this spawns a new process.
    pub async fn send_message(
        &self,
        session_id: &str,
        message: &str,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let mut sessions_lock = self.sessions.lock().await;

        if let Some(session) = sessions_lock.get_mut(session_id) {
            let adapter = self.get_adapter(&session.provider.clone())?;

            if adapter.supports_persistent_session() {
                if let Some(formatted) =
                    adapter.format_user_message(message, &session.session_id.clone())
                {
                    if let Some(stdin) = session.child.stdin.as_mut() {
                        stdin
                            .write_all(formatted.as_bytes())
                            .await
                            .map_err(|e| format!("stdin write error: {}", e))?;
                        stdin
                            .flush()
                            .await
                            .map_err(|e| format!("stdin flush error: {}", e))?;
                    }
                }
                Ok(())
            } else {
                let provider = session.provider.clone();
                let working_dir = session.working_dir.clone();
                drop(sessions_lock);

                self.start_codex_exec(&provider, &working_dir, session_id, message, app_handle)
                    .await
            }
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Spawn a one-shot codex exec process for a single prompt.
    async fn start_codex_exec(
        &self,
        provider: &str,
        working_dir: &Path,
        session_id: &str,
        prompt: &str,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let adapter = self.get_adapter(provider)?;
        let mut cmd = adapter.build_command(working_dir);
        cmd.arg(prompt);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn codex: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let sessions = self.sessions.clone();
        let sid = session_id.to_string();

        {
            let mut sessions_lock = sessions.lock().await;
            sessions_lock.insert(
                session_id.to_string(),
                CliSession {
                    child,
                    provider: provider.to_string(),
                    working_dir: working_dir.to_path_buf(),
                    session_id: session_id.to_string(),
                },
            );
        }

        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let parsed =
                    crate::cli::adapters::codex::CodexAdapter::new().parse_line(&line);
                match parsed {
                    Ok(Some(msg)) => {
                        let notification = JsonRpcNotification::new(
                            "cli.stream",
                            serde_json::to_value(&msg).unwrap_or_default(),
                        );
                        let _ = app_handle.emit("rpc-notification", &notification);
                    }
                    Ok(None) => {}
                    Err(e) => {
                        let err_notification = JsonRpcNotification::new(
                            "cli.stream",
                            serde_json::to_value(&UnifiedMessage::Error {
                                message: format!("Parse error: {}", e),
                            }).unwrap_or_default(),
                        );
                        let _ = app_handle.emit("rpc-notification", &err_notification);
                    }
                }
            }

            let turn_end = JsonRpcNotification::new(
                "cli.stream",
                serde_json::to_value(&UnifiedMessage::TurnEnd { usage: None }).unwrap_or_default(),
            );
            let _ = app_handle.emit("rpc-notification", &turn_end);

            let mut sessions_lock = sessions.lock().await;
            sessions_lock.remove(&sid);
        });

        Ok(())
    }

    /// Send a permission response to a running CLI session.
    pub async fn send_permission_response(
        &self,
        session_id: &str,
        request_id: &str,
        allowed: bool,
    ) -> Result<(), String> {
        let mut sessions_lock = self.sessions.lock().await;
        let session = sessions_lock
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        let adapter = self.get_adapter(&session.provider.clone())?;
        if let Some(formatted) = adapter.format_permission_response(request_id, allowed) {
            if let Some(stdin) = session.child.stdin.as_mut() {
                stdin
                    .write_all(formatted.as_bytes())
                    .await
                    .map_err(|e| format!("stdin write error: {}", e))?;
                stdin
                    .flush()
                    .await
                    .map_err(|e| format!("stdin flush error: {}", e))?;
            }
        }
        Ok(())
    }

    /// Stop a running CLI session.
    pub async fn stop_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions_lock = self.sessions.lock().await;
        if let Some(mut session) = sessions_lock.remove(session_id) {
            let _ = session.child.kill().await;
        }
        Ok(())
    }

    /// Check if a CLI is installed and get version.
    pub async fn check_installed(&self, provider: &str) -> Result<CliStatus, String> {
        let adapter = self.get_adapter(provider)?;
        let version_cmd = adapter.version_command();

        if version_cmd.is_empty() {
            return Ok(CliStatus {
                provider: provider.to_string(),
                installed: false,
                version: None,
                path: None,
                authenticated: false,
            });
        }

        let output = tokio::process::Command::new(&version_cmd[0])
            .args(&version_cmd[1..])
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let which_output = tokio::process::Command::new("which")
                    .arg(adapter.command())
                    .output()
                    .await;
                let path = which_output
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

                Ok(CliStatus {
                    provider: provider.to_string(),
                    installed: true,
                    version: Some(version),
                    path,
                    authenticated: false,
                })
            }
            _ => Ok(CliStatus {
                provider: provider.to_string(),
                installed: false,
                version: None,
                path: None,
                authenticated: false,
            }),
        }
    }

    /// Install a CLI tool.
    pub async fn install_cli(&self, provider: &str) -> Result<(), String> {
        let adapter = self.get_adapter(provider)?;
        let install_cmd = adapter
            .install_command()
            .ok_or_else(|| format!("No install command for {}", provider))?;

        if install_cmd.is_empty() {
            return Err("Empty install command".to_string());
        }

        let output = tokio::process::Command::new(&install_cmd[0])
            .args(&install_cmd[1..])
            .output()
            .await
            .map_err(|e| format!("Install failed: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Install failed: {}", stderr))
        }
    }
}
