use std::collections::HashMap;
use std::sync::Arc;

use super::antigravity::AntigravityProvider;
use super::claude::ClaudeProvider;
use super::codex::CodexProvider;
use super::copilot::CopilotProvider;
use super::gemini::GeminiProvider;
use super::mock::MockProvider;
use super::types::LLMProvider;

pub struct LLMRouter {
    providers: HashMap<String, Arc<dyn LLMProvider>>,
}

impl LLMRouter {
    pub fn new() -> Self {
        let mut providers: HashMap<String, Arc<dyn LLMProvider>> = HashMap::new();
        providers.insert("claude".to_string(), Arc::new(ClaudeProvider::new()));
        providers.insert("codex".to_string(), Arc::new(CodexProvider::new()));
        providers.insert("gemini".to_string(), Arc::new(GeminiProvider::new()));
        providers.insert("antigravity".to_string(), Arc::new(AntigravityProvider::new()));
        providers.insert("copilot".to_string(), Arc::new(CopilotProvider::new()));
        providers.insert("mock".to_string(), Arc::new(MockProvider::new()));
        Self { providers }
    }

    pub fn get_provider(&self, name: &str) -> Option<Arc<dyn LLMProvider>> {
        self.providers.get(name).cloned()
    }

    pub fn abort(&self, provider: &str) {
        if let Some(p) = self.providers.get(provider) {
            p.abort();
        }
    }

    /// Create a fresh, isolated provider instance (separate AbortController).
    /// Use for side requests like title generation to avoid conflicts.
    pub fn create_fresh(&self, name: &str) -> Option<Arc<dyn LLMProvider>> {
        match name {
            "claude" => Some(Arc::new(ClaudeProvider::new())),
            "codex" => Some(Arc::new(CodexProvider::new())),
            "gemini" => Some(Arc::new(GeminiProvider::new())),
            "antigravity" => Some(Arc::new(AntigravityProvider::new())),
            "copilot" => Some(Arc::new(CopilotProvider::new())),
            _ => None,
        }
    }
}
