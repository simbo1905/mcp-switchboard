// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures::StreamExt;
use tauri::Emitter;

// Import the pure business logic functions from mcp-core
use mcp_core::{BuildInfo, StreamMessage};

// Tauri command wrappers - ONLY place with #[tauri::command] macros!
#[tauri::command]
async fn get_api_config() -> Result<Option<String>, String> {
    mcp_core::get_api_config().await
}

#[tauri::command]
async fn save_api_config(api_key: String) -> Result<(), String> {
    mcp_core::save_api_config(api_key).await
}

#[tauri::command]
async fn has_api_config() -> Result<bool, String> {
    mcp_core::has_api_config().await
}

#[tauri::command]
async fn log_info(message: String) -> Result<(), String> {
    mcp_core::log_info(message).await
}

#[tauri::command]
async fn get_available_models() -> Result<Vec<mcp_core::ModelInfo>, String> {
    mcp_core::get_available_models().await
}

#[tauri::command]
async fn get_current_model() -> Result<String, String> {
    mcp_core::get_current_model().await
}

#[tauri::command]
async fn set_preferred_model(model: String) -> Result<(), String> {
    mcp_core::set_preferred_model(model).await
}

#[tauri::command]
async fn get_build_info() -> Result<BuildInfo, String> {
    mcp_core::get_build_info().await
}

#[tauri::command]
async fn send_streaming_message(
    message: String,
    window: tauri::Window,
) -> Result<(), String> {
    log::info!("Starting streaming message (Tauri wrapper)");
    
    // Call the pure business logic function to get the stream
    let mut stream = mcp_core::create_streaming_chat(message).await?;
    
    // Handle the stream and emit Tauri events
    while let Some(stream_message) = stream.next().await {
        match stream_message {
            StreamMessage::Content(content) => {
                if !content.is_empty() {
                    window.emit("chat-stream", content).map_err(|e| e.to_string())?;
                }
            }
            StreamMessage::Error(error) => {
                window.emit("chat-error", error).map_err(|e| e.to_string())?;
                break;
            }
            StreamMessage::Complete => {
                window.emit("chat-complete", ()).map_err(|e| e.to_string())?;
                break;
            }
        }
    }
    
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
            log_info,
            get_available_models,
            get_current_model,
            set_preferred_model,
            send_streaming_message,
            get_build_info
        ])
        .setup(|_app| {
            log::info!("MCP Switchboard application starting");
            log::info!("Pure architecture: mcp-core (business logic) + Tauri (UI integration)");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}