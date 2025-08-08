use std::path::PathBuf;
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, OsRng, AeadCore};
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use sha2::{Sha256, Digest};

#[derive(Serialize, Deserialize)]
struct AppConfig {
    together_ai_api_key: String,
    preferred_model: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            together_ai_api_key: String::new(),
            preferred_model: Some("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo".to_string()),
        }
    }
}

pub struct ConfigManager {
    config_dir: PathBuf,
    config_file: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Result<Self> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not determine config directory"))?
            .join("mcp-switchboard");

        let config_file = config_dir.join("config.json");

        Ok(ConfigManager {
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
            log::info!("Using API key from encrypted config file: {:?}", self.config_file);
            return Ok(Some(config.together_ai_api_key));
        }

        log::warn!("No API key found in environment or config file");
        Ok(None)
    }

    pub fn save_api_key(&self, api_key: String) -> Result<()> {
        log::info!("Saving API key to encrypted config file: {:?}", self.config_file);
        
        // Preserve existing config if it exists
        let mut config = self.load_config()?.unwrap_or_else(|| AppConfig {
            together_ai_api_key: String::new(),
            preferred_model: AppConfig::default().preferred_model,
        });
        config.together_ai_api_key = api_key;
        
        self.save_config(&config)?;
        log::info!("Config saved to: {:?}", self.config_file);
        log::info!("API key successfully saved and encrypted");
        Ok(())
    }

    pub fn get_preferred_model(&self) -> Result<String> {
        // First check if we have a saved preference
        if let Some(config) = self.load_config()? {
            if let Some(model) = config.preferred_model {
                log::info!("Using preferred model from config: {}", model);
                return Ok(model);
            }
        }
        
        // Fall back to default model
        let default_model = AppConfig::default().preferred_model.unwrap();
        log::info!("Using default model: {}", default_model);
        Ok(default_model)
    }

    pub fn save_preferred_model(&self, model: String) -> Result<()> {
        log::info!("Saving preferred model to config: {}", model);
        
        // Load existing config or create new one
        let mut config = self.load_config()?.unwrap_or_else(|| AppConfig {
            together_ai_api_key: String::new(),
            preferred_model: AppConfig::default().preferred_model,
        });
        config.preferred_model = Some(model);
        
        self.save_config(&config)?;
        log::info!("Preferred model saved successfully");
        Ok(())
    }

    fn load_config(&self) -> Result<Option<AppConfig>> {
        if !self.config_file.exists() {
            return Ok(None);
        }

        let encrypted_data = std::fs::read_to_string(&self.config_file)?;
        let decrypted_data = self.decrypt_data(&encrypted_data)?;
        let config: AppConfig = serde_json::from_slice(&decrypted_data)?;
        Ok(Some(config))
    }

    fn save_config(&self, config: &AppConfig) -> Result<()> {
        // Ensure config directory exists
        std::fs::create_dir_all(&self.config_dir)?;

        let json_data = serde_json::to_vec(config)?;
        let encrypted_data = self.encrypt_data(&json_data)?;
        std::fs::write(&self.config_file, encrypted_data)?;
        Ok(())
    }

    fn get_encryption_key(&self) -> Result<[u8; 32]> {
        // Generate a machine-specific key based on hostname and user
        let machine_id = format!(
            "{}:{}",
            std::env::var("USER").unwrap_or_else(|_| "unknown".to_string()),
            gethostname::gethostname().to_string_lossy()
        );
        
        let mut hasher = Sha256::new();
        hasher.update(machine_id.as_bytes());
        hasher.update(b"mcp-switchboard-config-key");
        let result = hasher.finalize();
        
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        Ok(key)
    }

    fn encrypt_data(&self, data: &[u8]) -> Result<String> {
        let key_bytes = self.get_encryption_key()?;
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher.encrypt(&nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
        
        // Combine nonce and ciphertext for storage
        let mut combined = nonce.to_vec();
        combined.extend_from_slice(&ciphertext);
        
        Ok(general_purpose::STANDARD.encode(&combined))
    }

    fn decrypt_data(&self, encrypted_data: &str) -> Result<Vec<u8>> {
        let combined = general_purpose::STANDARD.decode(encrypted_data)?;
        
        if combined.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data"));
        }
        
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let key_bytes = self.get_encryption_key()?;
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        
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