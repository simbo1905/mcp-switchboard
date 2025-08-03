// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use futures::stream::StreamExt;
use async_openai::Client;
use async_openai::config::OpenAIConfig;

#[derive(Clone, serde::Serialize)]
struct Payload {
  message: String,
}

#[tauri::command]
async fn send_streaming_message(
    message: String,
    api_key: String,
    window: tauri::Window,
) -> Result<(), String> {
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
        .invoke_handler(tauri::generate_handler![send_streaming_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}