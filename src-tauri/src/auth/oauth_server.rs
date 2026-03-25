use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

pub struct OAuthCallbackResult {
    pub code: String,
    pub state: String,
}

const SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html>
<head><title>Kangnam Client</title></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h1 style="color:#22c55e">Connected!</h1>
    <p>You can close this window and return to Kangnam Client.</p>
  </div>
</body>
</html>"#;

const ERROR_HTML_TEMPLATE: &str = r#"<!DOCTYPE html>
<html>
<head><title>Kangnam Client - Error</title></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h1 style="color:#ef4444">Authentication Failed</h1>
    <p>{{ERROR}}</p>
    <p>Please close this window and try again.</p>
  </div>
</body>
</html>"#;

/// Wait for an OAuth callback on a specific port.
/// Blocks the current thread until a callback is received or timeout.
pub fn wait_for_oauth_callback(
    port: u16,
    expected_path: &str,
) -> Result<OAuthCallbackResult, String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .map_err(|e| format!("Failed to bind port {port}: {e}"))?;

    // Set timeout (2 minutes)
    listener
        .set_nonblocking(false)
        .map_err(|e| format!("Failed to set blocking: {e}"))?;

    // Accept one connection
    let (mut stream, _) = listener.accept().map_err(|e| format!("Accept failed: {e}"))?;

    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| format!("Read failed: {e}"))?;

    // Parse: GET /path?code=xxx&state=yyy HTTP/1.1
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        send_error_response(&mut stream, "Invalid request");
        return Err("Invalid HTTP request".to_string());
    }

    let url_str = format!("http://127.0.0.1:{port}{}", parts[1]);
    let url = url::Url::parse(&url_str).map_err(|e| format!("URL parse failed: {e}"))?;

    if url.path() != expected_path {
        send_error_response(&mut stream, "Wrong path");
        return Err(format!("Unexpected path: {}", url.path()));
    }

    // Check for error
    if let Some(error) = url.query_pairs().find(|(k, _)| k == "error").map(|(_, v)| v.to_string()) {
        send_error_response(&mut stream, &error);
        return Err(format!("OAuth error: {error}"));
    }

    let code = url
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or("Missing code parameter")?;
    let state = url
        .query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .ok_or("Missing state parameter")?;

    send_success_response(&mut stream);

    Ok(OAuthCallbackResult { code, state })
}

/// Start a server on port 0 (OS-assigned) and return the actual port.
pub fn start_dynamic_oauth_server(
    expected_path: &str,
) -> Result<(u16, OAuthCallbackReceiver), String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind dynamic port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {e}"))?
        .port();

    Ok((port, OAuthCallbackReceiver {
        listener,
        expected_path: expected_path.to_string(),
        port,
    }))
}

pub struct OAuthCallbackReceiver {
    listener: TcpListener,
    expected_path: String,
    port: u16,
}

impl OAuthCallbackReceiver {
    /// Wait for the callback (blocking).
    pub fn wait(self) -> Result<OAuthCallbackResult, String> {
        let (mut stream, _) = self.listener.accept().map_err(|e| format!("Accept failed: {e}"))?;

        let mut reader = BufReader::new(stream.try_clone().unwrap());
        let mut request_line = String::new();
        reader
            .read_line(&mut request_line)
            .map_err(|e| format!("Read failed: {e}"))?;

        let parts: Vec<&str> = request_line.split_whitespace().collect();
        if parts.len() < 2 {
            send_error_response(&mut stream, "Invalid request");
            return Err("Invalid HTTP request".to_string());
        }

        let url_str = format!("http://127.0.0.1:{}{}", self.port, parts[1]);
        let url = url::Url::parse(&url_str).map_err(|e| format!("URL parse: {e}"))?;

        if url.path() != self.expected_path {
            send_error_response(&mut stream, "Wrong path");
            return Err(format!("Unexpected path: {}", url.path()));
        }

        if let Some(error) = url.query_pairs().find(|(k, _)| k == "error").map(|(_, v)| v.to_string()) {
            send_error_response(&mut stream, &error);
            return Err(format!("OAuth error: {error}"));
        }

        let code = url.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string()).ok_or("Missing code")?;
        let state = url.query_pairs().find(|(k, _)| k == "state").map(|(_, v)| v.to_string()).ok_or("Missing state")?;

        send_success_response(&mut stream);
        Ok(OAuthCallbackResult { code, state })
    }
}

fn send_success_response(stream: &mut std::net::TcpStream) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{SUCCESS_HTML}"
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&#39;")
}

fn send_error_response(stream: &mut std::net::TcpStream, error: &str) {
    let body = ERROR_HTML_TEMPLATE.replace("{{ERROR}}", &html_escape(error));
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{body}"
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}
