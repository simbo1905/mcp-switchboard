use std::process::Command;
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=src/");
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=/tmp/build-mcp-core.properties");

    // Verify mcp-core dependency exists and get its fingerprint
    let mcp_core_fingerprint = load_dependency_fingerprint("mcp-core")
        .unwrap_or_else(|| {
            panic!("ERROR: mcp-core build info not found! Must build mcp-core first.");
        });

    println!("cargo:warning=binding-generator depends on mcp-core fingerprint: {}", mcp_core_fingerprint);

    // Generate our own fingerprint
    let fingerprint = generate_fingerprint(&mcp_core_fingerprint);
    let git_commit = get_git_commit();
    let git_headline = get_git_headline();
    let build_time = chrono::Utc::now().to_rfc3339();
    
    // Create build info with dependency verification
    let build_info = serde_json::json!({
        "module": "binding-generator",
        "fingerprint": fingerprint,
        "git_commit": git_commit,
        "git_headline": git_headline,
        "build_time": build_time,
        "dependencies": [
            {
                "module": "mcp-core",
                "fingerprint": mcp_core_fingerprint,
                "verified": true
            }
        ]
    });

    // Write build info files
    fs::write("/tmp/build-info-binding-generator.json", build_info.to_string())
        .expect("Failed to write build info JSON");

    let props = format!(
        "MODULE=binding-generator\nFINGERPRINT={}\nGIT_SHA={}\nGIT_HEADLINE={}\nBUILD_TIME={}\nMCP_CORE_FINGERPRINT={}\n",
        fingerprint, git_commit, git_headline, build_time, mcp_core_fingerprint
    );
    fs::write("/tmp/build-binding-generator.properties", props)
        .expect("Failed to write build properties");

    println!("cargo:warning=binding-generator build fingerprint: {}", fingerprint);
    println!("cargo:warning=binding-generator verified mcp-core dependency: {}", mcp_core_fingerprint);
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

fn generate_fingerprint(mcp_core_fingerprint: &str) -> String {
    use std::collections::BTreeMap;
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    let mut files = BTreeMap::new();

    // Include dependency fingerprint in our fingerprint
    hasher.update(format!("mcp-core:{}", mcp_core_fingerprint).as_bytes());

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