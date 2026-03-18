use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub struct PkceChallenge {
    pub code_verifier: String,
    pub code_challenge: String,
}

/// Generate PKCE (Proof Key for Code Exchange) parameters.
pub fn generate_pkce() -> PkceChallenge {
    let mut bytes = [0u8; 48];
    rand::thread_rng().fill_bytes(&mut bytes);
    let encoded = URL_SAFE_NO_PAD.encode(bytes);
    let code_verifier = &encoded[..64]; // 48 bytes → 64 base64url chars

    let hash = Sha256::digest(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    PkceChallenge {
        code_verifier: code_verifier.to_string(),
        code_challenge,
    }
}

/// Generate a random state parameter for CSRF protection.
pub fn generate_state() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(&bytes)
}

// We need hex encoding — implement inline to avoid adding a dependency
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pkce_lengths() {
        let pkce = generate_pkce();
        assert_eq!(pkce.code_verifier.len(), 64);
        assert!(!pkce.code_challenge.is_empty());
    }

    #[test]
    fn test_state_length() {
        let state = generate_state();
        assert_eq!(state.len(), 32); // 16 bytes = 32 hex chars
    }

    #[test]
    fn test_pkce_unique() {
        let a = generate_pkce();
        let b = generate_pkce();
        assert_ne!(a.code_verifier, b.code_verifier);
    }
}
