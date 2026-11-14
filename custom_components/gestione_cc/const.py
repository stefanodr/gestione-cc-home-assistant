from datetime import timedelta

DOMAIN = "gestione_cc"
PLATFORMS = ["sensor", "binary_sensor", "button"]
CONF_CA_CERT = "ca_cert_path"
DEFAULT_CA_CERT = "/ssl/gestione-cc-ca.crt"
DEFAULT_SCAN_INTERVAL = timedelta(minutes=2)

API_ENDPOINTS = {
    "health": "health",
    "database": "database/status",
    "backups": "backups/status",
    "storage": "storage/status",
    "documents": "documents/status",
    "jobs": "jobs/status",
}

COMMANDS = {
    "local_backup": "commands/local-backup",
    "google_drive_backup": "commands/google-drive-backup",
    "integrity_check": "commands/integrity-check",
}
