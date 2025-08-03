// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;

use tauri::Emitter;
use futures::stream::StreamExt;
use async_openai::Client;
use async_openai::config::OpenAIConfig;
use config::ConfigManager;

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
    log::debug!("Frontend checking if API configuration exists");
    let config_manager = ConfigManager::new().map_err(|e| {
        log::error!("Failed to create config manager: {}", e);
        e.to_string()
    })?;
    let has_config = config_manager.has_config();
    log::debug!("API configuration exists: {}", has_config);
    Ok(has_config)
}

#[tauri::command]
async fn log_info(message: String) -> Result<(), String> {
    log::info!("[Frontend] {}", message);
    Ok(())
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

    let request = async_openai::types::CreateChatCompletionRequestArgs::default()
        .model("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo")
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
            log_info
        ])
        .setup(|_app| {
            log::info!("MCP Switchboard application starting");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}