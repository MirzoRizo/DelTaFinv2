# src-tauri/Cargo.toml
# Добавь зависимость tauri-plugin-sql в секцию [dependencies]
# 
# ВАЖНО: это не полный файл — только что нужно добавить/изменить
# Найди секцию [dependencies] в своём Cargo.toml и добавь строку:

# [dependencies]
# tauri = { version = "2", features = [] }
# tauri-plugin-sql = { version = "2", features = ["sqlite"] }   ← ДОБАВИТЬ ЭТУ СТРОКУ
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"

# ─── src-tauri/src/main.rs ────────────────────────────────────
# Также замени содержимое main.rs на это:

# fn main() {
#     warehouse_lib::run()
# }

# ─── src-tauri/src/lib.rs ─────────────────────────────────────
# Создай файл lib.rs (если нет) с таким содержимым:

# #[cfg_attr(mobile, tauri::mobile_entry_point)]
# pub fn run() {
#     tauri::Builder::default()
#         .plugin(tauri_plugin_sql::Builder::default().build())
#         .run(tauri::generate_context!())
#         .expect("error while running tauri application");
# }
