use std::process::Command;
use std::fs;
use std::env;

fn main() {
    println!("cargo:rerun-if-changed=src/");
    println!("cargo:rerun-if-changed=Cargo.toml");

    // Generate build fingerprint from source files
    let fingerprint = generate_fingerprint();
    let git_commit = get_git_commit();
    let git_headline = get_git_headline();
    let build_time = chrono::Utc::now().to_rfc3339();
    
    // Write embedded constants to OUT_DIR for include_str!
    let out_dir = env::var("OUT_DIR").unwrap();
    fs::write(format!("{}/fingerprint.txt", out_dir), &fingerprint)
        .expect("Failed to write fingerprint constant");
    fs::write(format!("{}/git_commit.txt", out_dir), &git_commit)
        .expect("Failed to write git commit constant");
    fs::write(format!("{}/git_headline.txt", out_dir), &git_headline)
        .expect("Failed to write git headline constant");
    fs::write(format!("{}/build_time.txt", out_dir), &build_time)
        .expect("Failed to write build time constant");
    
    // Create build info JSON
    let build_info = serde_json::json!({
        "module": "mcp-core",
        "fingerprint": fingerprint,
        "git_commit": git_commit,
        "git_headline": git_headline,
        "build_time": build_time,
        "dependencies": []
    });

    // Write build info files
    fs::write("/tmp/build-info-mcp-core.json", build_info.to_string())
        .expect("Failed to write build info JSON");

    // Write properties file for shell scripts
    let props = format!(
        "MODULE=mcp-core\nFINGERPRINT={}\nGIT_SHA={}\nGIT_HEADLINE={}\nBUILD_TIME={}\n",
        fingerprint, git_commit, git_headline, build_time
    );
    fs::write("/tmp/build-mcp-core.properties", props)
        .expect("Failed to write build properties");

    println!("cargo:warning=mcp-core build fingerprint: {}", fingerprint);
    println!("cargo:warning=mcp-core git commit: {}", git_commit);
    println!("cargo:warning=mcp-core build time: {}", build_time);
}

fn generate_fingerprint() -> String {
    use std::collections::BTreeMap;
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    let mut files = BTreeMap::new();

    // Collect all source files
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

    // Hash all files in sorted order for consistent fingerprint
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