// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;

use tauri::Emitter;
use futures::stream::StreamExt;
use async_openai::Client;
use async_openai::config::OpenAIConfig;
use config::ConfigManager;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
struct ModelInfo {
    id: String,
    display_name: String,
    organization: String,
}

#[derive(Clone, serde::Serialize)]
struct Payload {
  message: String,
}

#[tauri::command]
async fn get_api_config() -> Result<Option<String>, String> {
    log::debug!("Frontend requested API configuration");
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    config_manager.get_api_key().map_err(|e| {
        log::error!("Failed to get API key: {}", e);
        e.to_string()
    })
}

#[tauri::command]
async fn save_api_config(api_key: String) -> Result<(), String> {
    log::info!("Frontend requested to save API configuration");
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    config_manager.save_api_key(api_key).map_err(|e| {
        log::error!("Failed to save API key: {}", e);
        e.to_string()
    })
}

#[tauri::command]
async fn has_api_config() -> Result<bool, String> {
    log::info!("Frontend checking if API configuration exists");
    log::info!("Current working directory: {:?}", std::env::current_dir());
    log::info!("USER env var: {:?}", std::env::var("USER"));
    
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    
    log::info!("Config file path: {:?}", config_manager.get_config_path());
    log::info!("Config file exists: {}", config_manager.get_config_path().exists());
    log::info!("Environment variable TOGETHERAI_API_KEY set: {}", std::env::var("TOGETHERAI_API_KEY").is_ok());
    
    let has_config = config_manager.has_config();
    log::info!("Final has_config result: {}", has_config);
    Ok(has_config)
}

#[tauri::command]
async fn log_info(message: String) -> Result<(), String> {
    log::info!("[Frontend] {}", message);
    Ok(())
}

#[tauri::command]
async fn get_available_models() -> Result<Vec<ModelInfo>, String> {
    log::info!("Fetching available models from Together.ai API");
    
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    let api_key = config_manager.get_api_key().map_err(|e| {
        log::error!("Failed to get API key: {}", e);
        e.to_string()
    })?.ok_or_else(|| {
        log::error!("No API key configured");
        "No API key configured".to_string()
    })?;

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.together.xyz/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| {
            log::error!("Failed to fetch models: {}", e);
            e.to_string()
        })?;

    let models: serde_json::Value = response.json().await.map_err(|e| {
        log::error!("Failed to parse models response: {}", e);
        e.to_string()
    })?;

    let model_list = models.as_array().ok_or_else(|| {
        log::error!("Models response is not an array");
        "Invalid models response format".to_string()
    })?;

    let mut result = Vec::new();
    for model in model_list {
        if let Some(id) = model["id"].as_str() {
            let organization = model.get("organization")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown");
            let display_name = model.get("display_name")
                .and_then(|v| v.as_str())
                .unwrap_or(id);
            
            result.push(ModelInfo {
                id: id.to_string(),
                display_name: display_name.to_string(),
                organization: organization.to_string(),
            });
        }
    }

    log::info!("Successfully fetched {} models", result.len());
    Ok(result)
}

#[tauri::command]
async fn get_current_model() -> Result<String, String> {
    log::info!("Getting current preferred model");
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    config_manager.get_preferred_model().map_err(|e| {
        log::error!("Failed to get preferred model: {}", e);
        e.to_string()
    })
}

#[tauri::command]
async fn set_preferred_model(model: String) -> Result<(), String> {
    log::info!("Setting preferred model to: {}", model);
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    config_manager.save_preferred_model(model).map_err(|e| {
        log::error!("Failed to save preferred model: {}", e);
        e.to_string()
    })
}

#[tauri::command]
async fn send_streaming_message(
    message: String,
    window: tauri::Window,
) -> Result<(), String> {
    log::info!("Starting streaming message request");
    // Get API key from config
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager for streaming: {}", e);
        e.to_string()
    })?;
    let api_key = config_manager.get_api_key().map_err(|e| {
        log::error!("Failed to get API key for streaming: {}", e);
        e.to_string()
    })?.ok_or_else(|| {
        log::error!("No API key configured for streaming");
        "No API key configured".to_string()
    })?;
    let config = OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base("https://api.together.xyz/v1");

    let client = Client::with_config(config);

    // Get preferred model
    let model = config_manager.get_preferred_model().map_err(|e| {
        log::error!("Failed to get preferred model for streaming: {}", e);
        e.to_string()
    })?;
    log::info!("Using model for streaming: {}", model);

    let request = async_openai::types::CreateChatCompletionRequestArgs::default()
        .model(model)
        .messages(vec![
            async_openai::types::ChatCompletionRequestMessage::User(
                async_openai::types::ChatCompletionRequestUserMessageArgs::default()
                    .content(message)
                    .build()
                    .unwrap(),
            ),
        ])
        .stream(true)
        .build()
        .map_err(|e| e.to_string())?;

    let mut stream = client
        .chat()
        .create_stream(request)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(result) = stream.next().await {
        match result {
            Ok(response) => {
                if let Some(choice) = response.choices.first() {
                    if let Some(content) = &choice.delta.content {
                        window.emit("chat-stream", content).map_err(|e| e.to_string())?;
                    }
                }
            }
            Err(e) => {
                window.emit("chat-error", &e.to_string()).map_err(|e| e.to_string())?;
                break;
            }
        }
    }

    window.emit("chat-complete", ()).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_api_config,
            save_api_config,
            has_api_config,
            send_streaming_message,
            log_info,
            get_available_models,
            get_current_model,
            set_preferred_model
        ])
        .setup(|_app| {
            log::info!("MCP Switchboard application starting");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::env;

    // Create test helper that mirrors the config test helper
    fn create_test_config_manager() -> (config::ConfigManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        
        // Set up temporary config directory
        std::env::set_var("HOME", temp_dir.path().to_str().unwrap());
        
        let manager = config::ConfigManager::new().unwrap();
        (manager, temp_dir)
    }

    async fn create_test_config_with_api_key() -> (config::ConfigManager, TempDir) {
        let (manager, temp_dir) = create_test_config_manager();
        
        // Save a test API key
        manager.save_api_key("test-api-key-for-models".to_string()).unwrap();
        
        (manager, temp_dir)
    }

    #[tokio::test]
    async fn test_get_current_model_default() {
        env::remove_var("TOGETHERAI_API_KEY");
        let (manager, _temp) = create_test_config_with_api_key().await;
        
        let result = get_current_model_impl(&manager).await;
        assert!(result.is_ok(), "get_current_model should succeed");
        
        let model = result.unwrap();
        assert_eq!(model, "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "should return default model");
    }

    #[tokio::test]
    async fn test_set_and_get_preferred_model() {
        env::remove_var("TOGETHERAI_API_KEY");
        let (manager, _temp) = create_test_config_with_api_key().await;
        
        let test_model = "test-model-id";
        
        // Test setting preferred model
        let set_result = set_preferred_model_impl(&manager, test_model.to_string()).await;
        assert!(set_result.is_ok(), "set_preferred_model should succeed");
        
        // Test getting preferred model
        let get_result = get_current_model_impl(&manager).await;
        assert!(get_result.is_ok(), "get_current_model should succeed after setting");
        
        let model = get_result.unwrap();
        assert_eq!(model, test_model, "should return the set model");
    }

    #[tokio::test]
    async fn test_model_persistence_across_instances() {
        env::remove_var("TOGETHERAI_API_KEY");
        let temp_dir = TempDir::new().unwrap();
        
        let test_model = "persistent-test-model";
        
        // First instance - save model
        {
            std::env::set_var("HOME", temp_dir.path().to_str().unwrap());
            let manager1 = config::ConfigManager::new().unwrap();
            
            manager1.save_api_key("test-key".to_string()).unwrap();
            let set_result = set_preferred_model_impl(&manager1, test_model.to_string()).await;
            assert!(set_result.is_ok(), "first instance should save model");
        }
        
        // Second instance - load model (same HOME path)
        {
            let manager2 = config::ConfigManager::new().unwrap();
            
            let get_result = get_current_model_impl(&manager2).await;
            assert!(get_result.is_ok(), "second instance should load model");
            
            let model = get_result.unwrap();
            assert_eq!(model, test_model, "second instance should load same model");
        }
    }

    // Helper functions that mirror the Tauri commands but take ConfigManager directly
    async fn get_current_model_impl(config_manager: &config::ConfigManager) -> Result<String, String> {
        config_manager.get_preferred_model().map_err(|e| e.to_string())
    }

    async fn set_preferred_model_impl(config_manager: &config::ConfigManager, model: String) -> Result<(), String> {
        config_manager.save_preferred_model(model).map_err(|e| e.to_string())
    }

    // Mock test for get_available_models (since it requires actual API call)
    #[tokio::test]
    async fn test_get_available_models_structure() {
        // Test that the ModelInfo structure is correctly defined
        let model = ModelInfo {
            id: "test-model-id".to_string(),
            display_name: "Test Model".to_string(),
            organization: "Test Org".to_string(),
        };
        
        assert_eq!(model.id, "test-model-id");
        assert_eq!(model.display_name, "Test Model");
        assert_eq!(model.organization, "Test Org");
        
        // Test JSON serialization
        let json = serde_json::to_string(&model).unwrap();
        assert!(json.contains("test-model-id"));
        assert!(json.contains("Test Model"));
        assert!(json.contains("Test Org"));
        
        // Test JSON deserialization
        let deserialized: ModelInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, model.id);
        assert_eq!(deserialized.display_name, model.display_name);
        assert_eq!(deserialized.organization, model.organization);
    }

    #[tokio::test]
    async fn test_model_validation_workflow() {
        env::remove_var("TOGETHERAI_API_KEY");
        let (manager, _temp) = create_test_config_with_api_key().await;
        
        // Test setting various model formats
        let test_cases = vec![
            "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
            "anthropic/claude-3-sonnet",
            "openai/gpt-4",
            "custom-model-with-underscores_and_dashes-123",
        ];
        
        for test_model in test_cases {
            let set_result = set_preferred_model_impl(&manager, test_model.to_string()).await;
            assert!(set_result.is_ok(), "should accept model: {}", test_model);
            
            let get_result = get_current_model_impl(&manager).await;
            assert!(get_result.is_ok(), "should retrieve model: {}", test_model);
            
            let retrieved_model = get_result.unwrap();
            assert_eq!(retrieved_model, test_model, "retrieved model should match set model");
        }
    }
}