#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Debug builds: Info level, stdout only.
  // Release builds: Warn level, written to the OS application log directory.
  let log_plugin = if cfg!(debug_assertions) {
    tauri_plugin_log::Builder::new()
      .level(log::LevelFilter::Info)
      .build()
  } else {
    tauri_plugin_log::Builder::new()
      .level(log::LevelFilter::Warn)
      .target(tauri_plugin_log::Target::new(
        tauri_plugin_log::TargetKind::LogDir {
          file_name: Some("sentinel".to_string()),
        },
      ))
      .build()
  };

  tauri::Builder::default()
    .plugin(log_plugin)
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
