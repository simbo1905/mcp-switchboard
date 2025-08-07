// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use mcp_core::{
    get_api_config, save_api_config, has_api_config, log_info,
    get_available_models, get_current_model, set_preferred_model,
    send_streaming_message, ChatStreamPayload, ChatErrorPayload
};
use tauri_specta::{collect_commands, Builder};

fn main() {
    // Create the builder with all commands from mcp-core
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            get_api_config,
            save_api_config,
            has_api_config,
            log_info,
            get_available_models,
            get_current_model,
            set_preferred_model,
            send_streaming_message
        ])
        .events([
            ChatStreamPayload::EVENT,
            ChatErrorPayload::EVENT
        ]);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(builder.invoke_handler())
        .setup(|_app| {
            log::info!("MCP Switchboard application starting");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}