// Import types directly from mcp-core - NO MOCK FUNCTIONS!
use mcp_core::{ModelInfo, ApiError, ChatStreamPayload, ChatErrorPayload, BuildInfo, StreamMessage};
use specta::Type;
use tauri_specta::ts;

fn main() {
    println!("Generating TypeScript bindings from mcp-core types...");
    
    // Export the TYPES (not functions!) to TypeScript
    // The compiler already knows these types - no need to redefine!
    let types = vec![
        ts::export::<ModelInfo>(&Default::default()),
        ts::export::<ApiError>(&Default::default()),
        ts::export::<ChatStreamPayload>(&Default::default()),
        ts::export::<ChatErrorPayload>(&Default::default()),
        ts::export::<BuildInfo>(&Default::default()),
        ts::export::<StreamMessage>(&Default::default()),
        // Command return types
        ts::export::<Result<Option<String>, String>>(&Default::default()),
        ts::export::<Result<bool, String>>(&Default::default()),
        ts::export::<Result<Vec<ModelInfo>, String>>(&Default::default()),
        ts::export::<Result<String, String>>(&Default::default()),
        ts::export::<Result<(), String>>(&Default::default()),
        ts::export::<Result<BuildInfo, String>>(&Default::default()),
    ].into_iter()
    .collect::<Result<Vec<_>, _>>()
    .expect("Failed to generate TypeScript types");
    
    // Write all types to the bindings file
    let bindings_content = types.join("\n\n");
    std::fs::write("../src/lib/bindings.ts", bindings_content)
        .expect("Failed to write TypeScript bindings");

    println!("✅ TypeScript bindings generated successfully at ../src/lib/bindings.ts");
    println!("   Exported {} types from mcp-core (no mock functions needed!)", types.len());
}