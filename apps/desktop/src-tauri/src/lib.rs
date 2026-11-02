use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Deserialize, Serialize)]
struct Coordinates {
    lat: f64,
    lon: f64,
}

#[derive(Debug, Deserialize, Serialize)]
struct Encounter {
    tipo: String,
    #[serde(rename = "monitoradosEncontro")]
    monitorados_encontro: [u64; 2],
    timestamp: String,
    posicoes: BTreeMap<String, Coordinates>,
    #[serde(rename = "distanciaMetros")]
    distancia_metros: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalysisStats {
    datasets: usize,
    rows_processed: usize,
    duration_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalysisResult {
    output: String,
    encounters: Vec<Encounter>,
    stats: AnalysisStats,
}

fn output_file_name(dataset_path: &Path) -> Result<String, String> {
    let dataset_name = dataset_path
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid dataset filename: {}", dataset_path.display()))?;
    let output_name = dataset_name
        .get(..7)
        .filter(|prefix| prefix.eq_ignore_ascii_case("dataset"))
        .and_then(|_| dataset_name.get(7..))
        .filter(|number| !number.is_empty() && number.chars().all(|digit| digit.is_ascii_digit()))
        .map_or_else(
            || format!("{dataset_name}.json"),
            |number| format!("respostas{number}.json"),
        );

    Ok(output_name)
}

fn resolve_directory(workspace_root: &Path, directory: &Path) -> PathBuf {
    if directory.is_absolute() {
        directory.to_path_buf()
    } else {
        workspace_root.join(directory)
    }
}

fn dataset_paths(input_directory: &Path) -> Result<Vec<PathBuf>, String> {
    let mut dataset_paths = Vec::new();
    for entry in fs::read_dir(input_directory).map_err(|error| {
        format!(
            "Could not read the input directory \"{}\": {error}",
            input_directory.display()
        )
    })? {
        let entry = entry.map_err(|error| {
            format!(
                "Could not inspect a dataset in \"{}\": {error}",
                input_directory.display()
            )
        })?;
        let path = entry.path();
        if path.is_file()
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
        {
            dataset_paths.push(path);
        }
    }
    dataset_paths.sort();
    Ok(dataset_paths)
}

fn count_dataset_rows(dataset_path: &Path) -> Result<usize, String> {
    let file = File::open(dataset_path).map_err(|error| {
        format!(
            "Could not read the dataset \"{}\": {error}",
            dataset_path.display()
        )
    })?;
    Ok(BufReader::new(file).lines().count())
}

fn read_encounters(
    input_directory: &Path,
    output_directory: &Path,
) -> Result<Vec<Encounter>, String> {
    let dataset_paths = dataset_paths(input_directory)?;
    let mut encounters = Vec::new();

    for dataset_path in dataset_paths {
        let result_path = output_directory.join(output_file_name(&dataset_path)?);
        let result_bytes = fs::read(&result_path).map_err(|error| {
            format!(
                "Could not read CLI results for \"{}\" at \"{}\": {error}",
                dataset_path.display(),
                result_path.display()
            )
        })?;
        let dataset_encounters: Vec<Encounter> =
            serde_json::from_slice(&result_bytes).map_err(|error| {
                format!(
                    "Could not parse CLI results in \"{}\": {error}",
                    result_path.display()
                )
            })?;
        encounters.extend(dataset_encounters);
    }

    Ok(encounters)
}

#[tauri::command]
async fn run_analysis(
    app: AppHandle,
    input_directory: String,
    output_directory: String,
) -> Result<AnalysisResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let workspace_root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .ok_or_else(|| "Could not locate the workspace root.".to_owned())?;
        let cli_entry = workspace_root.join("apps").join("cli").join("dist").join("index.mjs");

        if !cli_entry.is_file() {
            return Err(
                "The CLI build is missing. Restart the desktop app to build it, or run `pnpm build:cli`."
                    .to_owned(),
            );
        }

        let resolved_input_directory = resolve_directory(workspace_root, Path::new(&input_directory));
        let resolved_output_directory =
            resolve_directory(workspace_root, Path::new(&output_directory));
        let dataset_paths = dataset_paths(&resolved_input_directory)?;
        let mut rows_processed = 0;
        for dataset_path in &dataset_paths {
            rows_processed += count_dataset_rows(dataset_path)?;
        }
        let mut child = Command::new("node")
            .arg(cli_entry)
            .args(["process-all", "--input"])
            .arg(&input_directory)
            .arg("--output")
            .arg(&output_directory)
            .args(["--unsorted", "auto"])
            .current_dir(workspace_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| {
                format!("Could not start Node.js to run the CLI. Install Node.js 24.11 or newer. {error}")
            })?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Could not capture CLI output.".to_owned())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Could not capture CLI errors.".to_owned())?;
        let stderr_reader = std::thread::spawn(move || {
            let mut output = String::new();
            BufReader::new(stderr)
                .read_to_string(&mut output)
                .map(|_| output)
        });
        let mut output = String::new();

        let stdout_result = (|| {
            for line in BufReader::new(stdout).lines() {
                let line = line.map_err(|error| format!("Could not read CLI output: {error}"))?;
                output.push_str(&line);
                output.push('\n');

                if let Err(error) = app.emit("analysis-output", &line) {
                    eprintln!("Could not stream CLI output to the app: {error}");
                }
            }
            Ok::<(), String>(())
        })();

        if let Err(error) = stdout_result {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }

        let status = child
            .wait()
            .map_err(|error| format!("Could not wait for the CLI to finish: {error}"))?;
        let stderr = stderr_reader
            .join()
            .map_err(|_| "Could not collect CLI error output.".to_owned())?
            .map_err(|error| format!("Could not read CLI errors: {error}"))?;

        if !status.success() {
            let details = stderr.trim();
            let details = if details.is_empty() {
                output.trim()
            } else {
                details
            };
            return Err(format!("CLI exited with status {:?}: {details}", status.code()));
        }

        Ok(AnalysisResult {
            output: output.trim().to_owned(),
            encounters: read_encounters(&resolved_input_directory, &resolved_output_directory)?,
            stats: AnalysisStats {
                datasets: dataset_paths.len(),
                rows_processed,
                duration_ms: u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX),
            },
        })
    })
    .await
    .map_err(|error| format!("The analysis task could not be completed: {error}"))?
}

#[tauri::command]
fn reveal_directory(app: AppHandle, directory: String) -> Result<(), String> {
    let workspace_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .ok_or_else(|| "Could not locate the workspace root.".to_owned())?;
    let resolved = resolve_directory(workspace_root, Path::new(&directory));

    if !resolved.is_dir() {
        return Err(format!(
            "The folder \"{}\" does not exist yet.",
            resolved.display()
        ));
    }

    app.opener()
        .open_path(resolved.display().to_string(), None::<&str>)
        .map_err(|error| format!("Could not open the folder: {error}"))
}

#[tauri::command]
async fn export_report(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::write(&path, content.as_bytes()).map_err(|error| {
            format!(
                "Could not write the export to \"{}\": {error}",
                path
            )
        })
    })
    .await
    .map_err(|error| format!("The export task could not be completed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_analysis,
            export_report,
            reveal_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{Encounter, output_file_name, read_encounters, resolve_directory};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let unique_id = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock should be after UNIX epoch")
                .as_nanos();
            let directory = std::env::temp_dir().join(format!(
                "spacecom-desktop-rust-test-{}-{unique_id}",
                std::process::id()
            ));
            fs::create_dir_all(&directory).expect("temporary test directory should be created");
            Self(directory)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    const ENCOUNTER_JSON: &str = r#"{"tipo":"generico","monitoradosEncontro":[21,34],"timestamp":"2026-01-02 03:04:05","posicoes":{"21":{"lat":-25.4,"lon":-49.2},"34":{"lat":-25.4,"lon":-49.2}},"distanciaMetros":12.5}"#;

    #[test]
    fn maps_dataset_names_to_cli_output_names() {
        assert_eq!(
            output_file_name(Path::new("dataset12.txt")).unwrap(),
            "respostas12.json"
        );
        assert_eq!(
            output_file_name(Path::new("Dataset2.TXT")).unwrap(),
            "respostas2.json"
        );
        assert_eq!(
            output_file_name(Path::new("custom-data.txt")).unwrap(),
            "custom-data.json"
        );
    }

    #[test]
    fn deserializes_cli_encounter_json() {
        let encounter: Encounter = serde_json::from_str(ENCOUNTER_JSON).unwrap();

        assert_eq!(encounter.monitorados_encontro, [21, 34]);
        assert_eq!(encounter.distancia_metros, 12.5);
        assert_eq!(encounter.posicoes.len(), 2);
    }

    #[test]
    fn resolves_relative_directories_against_workspace_root() {
        let workspace_root = Path::new("workspace");

        assert_eq!(
            resolve_directory(workspace_root, Path::new("datasets/inputs")),
            Path::new("workspace/datasets/inputs")
        );
    }

    #[test]
    fn preserves_absolute_directories() {
        let absolute_directory = std::env::temp_dir();

        assert_eq!(
            resolve_directory(Path::new("workspace"), &absolute_directory),
            absolute_directory
        );
    }

    #[test]
    fn reads_results_for_txt_datasets_in_sorted_order() {
        let temporary_directory = TestDirectory::new();
        let input_directory = temporary_directory.path().join("inputs");
        let output_directory = temporary_directory.path().join("outputs");
        fs::create_dir_all(&input_directory).unwrap();
        fs::create_dir_all(&output_directory).unwrap();
        fs::write(input_directory.join("dataset2.txt"), "dataset").unwrap();
        fs::write(input_directory.join("dataset1.txt"), "dataset").unwrap();
        fs::write(input_directory.join("notes.md"), "not a dataset").unwrap();
        fs::write(
            output_directory.join("respostas1.json"),
            format!("[{ENCOUNTER_JSON}]"),
        )
        .unwrap();
        fs::write(output_directory.join("respostas2.json"), "[]").unwrap();

        let encounters = read_encounters(&input_directory, &output_directory).unwrap();

        assert_eq!(encounters.len(), 1);
        assert_eq!(encounters[0].monitorados_encontro, [21, 34]);
    }

    #[test]
    fn reports_when_cli_output_is_missing() {
        let temporary_directory = TestDirectory::new();
        let input_directory = temporary_directory.path().join("inputs");
        let output_directory = temporary_directory.path().join("outputs");
        fs::create_dir_all(&input_directory).unwrap();
        fs::create_dir_all(&output_directory).unwrap();
        fs::write(input_directory.join("dataset1.txt"), "dataset").unwrap();

        let error = read_encounters(&input_directory, &output_directory).unwrap_err();

        assert!(error.contains("Could not read CLI results for"));
        assert!(error.contains("respostas1.json"));
    }

    #[test]
    fn reports_invalid_cli_json_with_its_path() {
        let temporary_directory = TestDirectory::new();
        let input_directory = temporary_directory.path().join("inputs");
        let output_directory = temporary_directory.path().join("outputs");
        fs::create_dir_all(&input_directory).unwrap();
        fs::create_dir_all(&output_directory).unwrap();
        fs::write(input_directory.join("dataset1.txt"), "dataset").unwrap();
        fs::write(output_directory.join("respostas1.json"), "{invalid").unwrap();

        let error = read_encounters(&input_directory, &output_directory).unwrap_err();

        assert!(error.contains("Could not parse CLI results in"));
        assert!(error.contains("respostas1.json"));
    }
}
