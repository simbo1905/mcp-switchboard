use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::{collect_commands, Builder};

// Re-define the types exactly as they are in main.rs
#[derive(Serialize, Deserialize, Clone, Type)]
#[specta(export)]
struct ModelInfo {
    id: String,
    display_name: String,
    organization: String,
}

#[derive(Serialize, Deserialize, Type)]
#[specta(export)]
struct ApiError {
    message: String,
    code: Option<String>,
}

#[derive(Serialize, Type)]
#[specta(export)]
pub struct ChatStreamPayload {
    pub content: String,
}

#[derive(Serialize, Type)]
#[specta(export)]
pub struct ChatErrorPayload {
    pub error: String,
}

// Mock command signatures - these need to match the actual commands in main.rs
#[tauri::command]
#[specta::specta]
async fn get_api_config() -> Result<Option<String>, String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn save_api_config(api_key: String) -> Result<(), String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn has_api_config() -> Result<bool, String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn log_info(message: String) -> Result<(), String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn get_available_models() -> Result<Vec<ModelInfo>, String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn get_current_model() -> Result<String, String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn set_preferred_model(model: String) -> Result<(), String> {
    unimplemented!("This is just for type generation")
}

#[tauri::command]
#[specta::specta]
async fn send_streaming_message(
    message: String,
    _window: tauri::Window,
) -> Result<(), String> {
    unimplemented!("This is just for type generation")
}

fn main() {
    println!("Generating TypeScript bindings...");
    
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            get_api_config,
            save_api_config,
            has_api_config,
            send_streaming_message,
            log_info,
            get_available_models,
            get_current_model,
            set_preferred_model
        ]);

    builder.export(tauri_specta::ts::export_with_cfg(tauri_specta::ts::ExportConfig::default()), "../src/lib/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    println!("✅ TypeScript bindings generated successfully at ../src/lib/bindings.ts");
}