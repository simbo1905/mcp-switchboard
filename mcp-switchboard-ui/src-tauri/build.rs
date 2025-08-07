use std::process::Command;
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=src/");
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=/tmp/build-mcp-core.properties");
    println!("cargo:rerun-if-changed=/tmp/build-binding-generator.properties");

    // Verify all dependencies exist and get their fingerprints
    let mcp_core_fingerprint = load_dependency_fingerprint("mcp-core")
        .unwrap_or_else(|| {
            panic!("ERROR: mcp-core build info not found! Must build mcp-core first.");
        });

    let binding_gen_fingerprint = load_dependency_fingerprint("binding-generator")
        .unwrap_or_else(|| {
            panic!("ERROR: binding-generator build info not found! Must run binding generator first.");
        });

    println!("cargo:warning=mcp-switchboard-ui depends on mcp-core fingerprint: {}", mcp_core_fingerprint);
    println!("cargo:warning=mcp-switchboard-ui depends on binding-generator fingerprint: {}", binding_gen_fingerprint);

    // Check that TypeScript bindings exist and have the right fingerprint
    if !std::path::Path::new("../src/bindings.ts").exists() {
        panic!("ERROR: TypeScript bindings not found! Must run binding generator first.");
    }

    // Verify bindings contain the expected fingerprint
    if let Ok(bindings_content) = fs::read_to_string("../src/bindings.ts") {
        if !bindings_content.contains(&binding_gen_fingerprint) {
            panic!("ERROR: TypeScript bindings do not match binding-generator fingerprint! Run npm run generate-bindings first.");
        }
        println!("cargo:warning=TypeScript bindings fingerprint verified: {}", binding_gen_fingerprint);
    }

    // Generate our own fingerprint
    let fingerprint = generate_fingerprint(&mcp_core_fingerprint, &binding_gen_fingerprint);
    let git_commit = get_git_commit();
    let git_headline = get_git_headline();
    let build_time = chrono::Utc::now().to_rfc3339();
    
    // Create build info with dependency verification
    let build_info = serde_json::json!({
        "module": "mcp-switchboard-ui",
        "fingerprint": fingerprint,
        "git_commit": git_commit,
        "git_headline": git_headline,
        "build_time": build_time,
        "dependencies": [
            {
                "module": "mcp-core",
                "fingerprint": mcp_core_fingerprint,
                "verified": true
            },
            {
                "module": "binding-generator", 
                "fingerprint": binding_gen_fingerprint,
                "verified": true
            }
        ]
    });

    // Write build info files
    fs::write("/tmp/build-info-mcp-switchboard-ui.json", build_info.to_string())
        .expect("Failed to write build info JSON");

    let props = format!(
        "MODULE=mcp-switchboard-ui\nFINGERPRINT={}\nGIT_SHA={}\nGIT_HEADLINE={}\nBUILD_TIME={}\nMCP_CORE_FINGERPRINT={}\nBINDING_GEN_FINGERPRINT={}\n",
        fingerprint, git_commit, git_headline, build_time, mcp_core_fingerprint, binding_gen_fingerprint
    );
    fs::write("/tmp/build-mcp-switchboard-ui.properties", props)
        .expect("Failed to write build properties");

    println!("cargo:warning=mcp-switchboard-ui build fingerprint: {}", fingerprint);
    println!("cargo:warning=All dependencies verified and fresh!");

    tauri_build::build()
}

fn load_dependency_fingerprint(module: &str) -> Option<String> {
    let props_file = format!("/tmp/build-{}.properties", module);
    if let Ok(content) = fs::read_to_string(&props_file) {
        for line in content.lines() {
            if line.starts_with("FINGERPRINT=") {
                return Some(line.replace("FINGERPRINT=", ""));
            }
        }
    }
    None
}

fn generate_fingerprint(mcp_core_fingerprint: &str, binding_gen_fingerprint: &str) -> String {
    use std::collections::BTreeMap;
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    let mut files = BTreeMap::new();

    // Include dependency fingerprints
    hasher.update(format!("mcp-core:{}", mcp_core_fingerprint).as_bytes());
    hasher.update(format!("binding-generator:{}", binding_gen_fingerprint).as_bytes());

    // Collect our source files
    for entry in walkdir::WalkDir::new("src") {
        if let Ok(entry) = entry {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "rs" {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            files.insert(entry.path().to_string_lossy().to_string(), content);
                        }
                    }
                }
            }
        }
    }

    // Add Cargo.toml
    if let Ok(content) = fs::read_to_string("Cargo.toml") {
        files.insert("Cargo.toml".to_string(), content);
    }

    // Include TypeScript bindings in our fingerprint
    if let Ok(content) = fs::read_to_string("../src/bindings.ts") {
        files.insert("bindings.ts".to_string(), content);
    }

    // Hash all files in sorted order
    for (path, content) in files {
        hasher.update(path.as_bytes());
        hasher.update(content.as_bytes());
    }

    format!("{:x}", hasher.finalize())
}

fn get_git_commit() -> String {
    Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

fn get_git_headline() -> String {
    Command::new("git")
        .args(&["log", "-1", "--pretty=%s"])
        .output()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}
