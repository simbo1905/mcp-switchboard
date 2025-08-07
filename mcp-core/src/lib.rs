use serde::{Deserialize, Serialize};
use futures::stream::{StreamExt, Stream};
use async_openai::Client;
use async_openai::config::OpenAIConfig;
use std::pin::Pin;

// Re-export everything needed by consumers
pub use config::ConfigManager;
pub use build_info::{BuildInfo, DependencyInfo};

mod config;
mod build_info;

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub display_name: String,
    pub organization: String,
}

#[derive(Serialize, Deserialize)]
pub struct ApiError {
    pub message: String,
    pub code: Option<String>,
}

// Stream message types for pure streaming API
#[derive(Serialize, Clone)]
pub enum StreamMessage {
    Content(String),
    Error(String),
    Complete,
}

// Event payload types (for UI layer compatibility)
#[derive(Serialize)]
pub struct ChatStreamPayload {
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatErrorPayload {
    pub error: String,
}


pub async fn get_api_config() -> Result<Option<String>, String> {
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

pub async fn save_api_config(api_key: String) -> Result<(), String> {
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

pub async fn has_api_config() -> Result<bool, String> {
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


pub async fn log_info(message: String) -> Result<(), String> {
    log::info!("[Frontend] {}", message);
    Ok(())
}


pub async fn get_available_models() -> Result<Vec<ModelInfo>, String> {
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


pub async fn get_current_model() -> Result<String, String> {
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


pub async fn set_preferred_model(model: String) -> Result<(), String> {
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


pub async fn create_streaming_chat(
    message: String,
) -> Result<Pin<Box<dyn Stream<Item = StreamMessage> + Send>>, String> {
    log::info!("Creating streaming chat for message");
    
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

    let openai_stream = client
        .chat()
        .create_stream(request)
        .await
        .map_err(|e| e.to_string())?;

    // Transform the OpenAI stream into our StreamMessage enum
    let message_stream = openai_stream.map(|result| {
        match result {
            Ok(response) => {
                if let Some(choice) = response.choices.first() {
                    if let Some(content) = &choice.delta.content {
                        StreamMessage::Content(content.clone())
                    } else {
                        // Empty content chunk, skip
                        StreamMessage::Content(String::new())
                    }
                } else {
                    StreamMessage::Content(String::new())
                }
            }
            Err(e) => StreamMessage::Error(e.to_string())
        }
    }).chain(futures::stream::once(async { StreamMessage::Complete }));

    Ok(Box::pin(message_stream))
}


pub async fn get_build_info() -> Result<BuildInfo, String> {
    let build_info = BuildInfo::load().map_err(|e| e.to_string())?;
    Ok(build_info)
}