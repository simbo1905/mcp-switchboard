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
        let config = AppConfig {
            together_ai_api_key: api_key,
        };
        self.save_config(&config)?;
        log::info!("Config saved to: {:?}", self.config_file);
        log::info!("API key successfully saved and encrypted");
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_config_manager() -> (ConfigManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config_dir = temp_dir.path().join("mcp-switchboard");
        let config_file = config_dir.join("config.json");
        
        let manager = ConfigManager {
            config_dir,
            config_file,
        };
        
        (manager, temp_dir)
    }

    #[test]
    fn test_has_config_with_no_file_no_env() {
        std::env::remove_var("TOGETHERAI_API_KEY");
        let (manager, _temp) = create_test_config_manager();
        
        assert!(!manager.has_config(), "should return false when no config file and no env var");
    }

    #[test]
    fn test_has_config_with_env_var() {
        std::env::set_var("TOGETHERAI_API_KEY", "test-key");
        let (manager, _temp) = create_test_config_manager();
        
        assert!(manager.has_config(), "should return true when env var is set");
        
        std::env::remove_var("TOGETHERAI_API_KEY");
    }

    #[test]
    fn test_has_config_with_file() {
        std::env::remove_var("TOGETHERAI_API_KEY");
        let (manager, _temp) = create_test_config_manager();
        
        // Create the config directory and file
        fs::create_dir_all(&manager.config_dir).unwrap();
        fs::write(&manager.config_file, "dummy content").unwrap();
        
        assert!(manager.has_config(), "should return true when config file exists");
    }

    #[test]
    fn test_save_and_load_config() {
        std::env::remove_var("TOGETHERAI_API_KEY");
        let (manager, _temp) = create_test_config_manager();
        
        let test_key = "test-api-key-12345";
        
        // Test saving
        manager.save_api_key(test_key.to_string()).unwrap();
        
        // Test that file was created
        assert!(manager.config_file.exists(), "config file should exist after saving");
        assert!(manager.has_config(), "has_config should return true after saving");
        
        // Test loading
        let loaded_key = manager.get_api_key().unwrap();
        assert_eq!(loaded_key, Some(test_key.to_string()), "loaded key should match saved key");
    }

    #[test]
    fn test_encryption_roundtrip() {
        let (manager, _temp) = create_test_config_manager();
        
        let test_data = b"test encryption data";
        let encrypted = manager.encrypt_data(test_data).unwrap();
        let decrypted = manager.decrypt_data(&encrypted).unwrap();
        
        assert_eq!(test_data, decrypted.as_slice(), "decrypted data should match original");
    }

    #[test]
    fn test_config_persistence_across_instances() {
        std::env::remove_var("TOGETHERAI_API_KEY");
        let temp_dir = TempDir::new().unwrap();
        let config_dir = temp_dir.path().join("mcp-switchboard");
        let config_file = config_dir.join("config.json");
        
        let test_key = "persistent-test-key";
        
        // First instance - save config
        {
            let manager1 = ConfigManager {
                config_dir: config_dir.clone(),
                config_file: config_file.clone(),
            };
            
            manager1.save_api_key(test_key.to_string()).unwrap();
            assert!(manager1.has_config(), "first instance should detect config");
        }
        
        // Second instance - load config
        {
            let manager2 = ConfigManager {
                config_dir: config_dir.clone(),
                config_file: config_file.clone(),
            };
            
            assert!(manager2.has_config(), "second instance should detect existing config");
            let loaded_key = manager2.get_api_key().unwrap();
            assert_eq!(loaded_key, Some(test_key.to_string()), "second instance should load same key");
        }
    }

    #[test]
    fn test_env_var_priority() {
        let env_key = "env-var-key";
        let file_key = "file-key";
        
        std::env::set_var("TOGETHERAI_API_KEY", env_key);
        let (manager, _temp) = create_test_config_manager();
        
        // Save a different key to file
        manager.save_api_key(file_key.to_string()).unwrap();
        
        // Environment variable should take priority
        let loaded_key = manager.get_api_key().unwrap();
        assert_eq!(loaded_key, Some(env_key.to_string()), "env var should take priority over file");
        
        std::env::remove_var("TOGETHERAI_API_KEY");
    }
}