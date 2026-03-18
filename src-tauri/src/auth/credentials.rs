/// OAuth credentials for each provider (from open-source implementations)

pub struct OAuthCredentials {
    pub client_id: &'static str,
    pub client_secret: Option<&'static str>,
    pub auth_url: Option<&'static str>,
    pub token_url: &'static str,
    pub redirect_port: Option<u16>,
    pub redirect_path: &'static str,
    pub scopes: &'static str,
}

pub const CODEX: OAuthCredentials = OAuthCredentials {
    client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
    client_secret: None,
    auth_url: Some("https://auth.openai.com/oauth/authorize"),
    token_url: "https://auth.openai.com/oauth/token",
    redirect_port: Some(1455),
    redirect_path: "/auth/callback",
    scopes: "openid profile email offline_access",
};

pub const GEMINI: OAuthCredentials = OAuthCredentials {
    client_id: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
    client_secret: Some("***REMOVED***"),
    auth_url: Some("https://accounts.google.com/o/oauth2/v2/auth"),
    token_url: "https://oauth2.googleapis.com/token",
    redirect_port: None, // Dynamic port
    redirect_path: "/oauth2callback",
    scopes: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
};

pub const ANTIGRAVITY: OAuthCredentials = OAuthCredentials {
    client_id: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    client_secret: Some("***REMOVED***"),
    auth_url: Some("https://accounts.google.com/o/oauth2/v2/auth"),
    token_url: "https://oauth2.googleapis.com/token",
    redirect_port: Some(51121),
    redirect_path: "/oauth-callback",
    scopes: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs",
};

pub struct CopilotCredentials {
    pub client_id: &'static str,
    pub device_code_url: &'static str,
    pub token_url: &'static str,
    pub copilot_token_url: &'static str,
    pub scope: &'static str,
}

pub const COPILOT: CopilotCredentials = CopilotCredentials {
    client_id: "Iv1.b507a08c87ecfe98",
    device_code_url: "https://github.com/login/device/code",
    token_url: "https://github.com/login/oauth/access_token",
    copilot_token_url: "https://api.github.com/copilot_internal/v2/token",
    scope: "read:user",
};

pub struct ClaudeOAuthCredentials {
    pub client_id: &'static str,
    pub token_url: &'static str,
}

pub const CLAUDE_OAUTH: ClaudeOAuthCredentials = ClaudeOAuthCredentials {
    client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    token_url: "https://platform.claude.com/v1/oauth/token",
};
