use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{Context, Result};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub together_ai_api_key: String,
}

pub struct ConfigManager {
    config_dir: PathBuf,
    config_file: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Result<Self> {
        let config_dir = dirs::config_dir()
            .context("Could not determine config directory")?
            .join("mcp-switchboard");
        
        let config_file = config_dir.join("config.json");
        
        Ok(Self {
            config_dir,
            config_file,
        })
    }

    pub fn get_api_key(&self) -> Result<Option<String>> {
        // First check environment variable (for development)
        if let Ok(env_key) = std::env::var("TOGETHERAI_API_KEY") {
            if !env_key.is_empty() {
                log::info!("Using API key from environment variable");
                return Ok(Some(env_key));
            }
        }

        // Then check encrypted config file
        if let Some(config) = self.load_config()? {
            log::info!("Using API key from config file");
            return Ok(Some(config.together_ai_api_key));
        }

        Ok(None)
    }

    pub fn save_api_key(&self, api_key: String) -> Result<()> {
        let config = AppConfig {
            together_ai_api_key: api_key,
        };
        self.save_config(&config)
    }

    fn load_config(&self) -> Result<Option<AppConfig>> {
        if !self.config_file.exists() {
            return Ok(None);
        }

        let encrypted_data = fs::read(&self.config_file)
            .context("Failed to read config file")?;

        if encrypted_data.is_empty() {
            return Ok(None);
        }

        let decrypted_data = self.decrypt_data(&encrypted_data)
            .context("Failed to decrypt config file")?;

        let config: AppConfig = serde_json::from_slice(&decrypted_data)
            .context("Failed to parse config file")?;

        Ok(Some(config))
    }

    fn save_config(&self, config: &AppConfig) -> Result<()> {
        // Ensure config directory exists
        fs::create_dir_all(&self.config_dir)
            .context("Failed to create config directory")?;

        let json_data = serde_json::to_vec(config)
            .context("Failed to serialize config")?;

        let encrypted_data = self.encrypt_data(&json_data)
            .context("Failed to encrypt config")?;

        fs::write(&self.config_file, encrypted_data)
            .context("Failed to write config file")?;

        log::info!("Config saved to: {:?}", self.config_file);
        Ok(())
    }

    fn get_encryption_key(&self) -> Result<[u8; 32]> {
        // Generate a machine-specific key based on config directory path
        // This is a simple approach - in production, you might want to use
        // more sophisticated key derivation
        let mut hasher = Sha256::new();
        hasher.update(self.config_dir.to_string_lossy().as_bytes());
        hasher.update(b"mcp-switchboard-encryption-salt");
        
        // Add some system-specific data for uniqueness
        if let Ok(hostname) = std::env::var("COMPUTERNAME") {
            hasher.update(hostname.as_bytes());
        } else if let Ok(hostname) = std::env::var("HOSTNAME") {
            hasher.update(hostname.as_bytes());
        }

        let result = hasher.finalize();
        Ok(result.into())
    }

    fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let key = self.get_encryption_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .context("Failed to create cipher")?;

        // Use a fixed nonce for simplicity - in production, use random nonce
        // and store it with the encrypted data
        let nonce = Nonce::from_slice(b"unique_nonce"); // 12 bytes
        
        let ciphertext = cipher.encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Encode as base64 for safe file storage
        Ok(general_purpose::STANDARD.encode(ciphertext).into_bytes())
    }

    fn decrypt_data(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        let key = self.get_encryption_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .context("Failed to create cipher")?;

        // Decode from base64
        let ciphertext = general_purpose::STANDARD.decode(encrypted_data)
            .context("Failed to decode base64 data")?;

        let nonce = Nonce::from_slice(b"unique_nonce"); // 12 bytes
        
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        Ok(plaintext)
    }

    pub fn has_config(&self) -> bool {
        // Check if we have either env var or config file
        std::env::var("TOGETHERAI_API_KEY").is_ok() || self.config_file.exists()
    }

    pub fn get_config_path(&self) -> &PathBuf {
        &self.config_file
    }
}