from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from homeassistant.const import UnitOfInformation
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


SENSORS = [
    ("app_version", "health", "app_version", "Versione applicazione", "mdi:tag-outline", None, None),
    ("addon_version", "health", "addon_version", "Versione add-on", "mdi:puzzle-outline", None, None),
    ("uptime", "health", "uptime_seconds", "Tempo attività", "mdi:timer-outline", None, SensorStateClass.MEASUREMENT),
    ("database_size", "database", "size_bytes", "Dimensione database", "mdi:database", UnitOfInformation.BYTES, SensorStateClass.MEASUREMENT),
    ("database_last_write", "database", "last_write_at", "Ultima modifica database", "mdi:database-clock", None, None),
    ("database_last_check", "database", "last_check_at", "Ultimo controllo integrità", "mdi:database-check", None, None),
    ("backup_local_count", "backups", "local_count", "Copie backup locali", "mdi:backup-restore", None, SensorStateClass.MEASUREMENT),
    ("backup_local_last", "backups", "local_last_at", "Ultimo backup locale", "mdi:clock-check-outline", None, None),
    ("backup_drive_last", "backups", "drive_last_at", "Ultimo backup Google Drive", "mdi:cloud-check-outline", None, None),
    ("storage_total", "storage", "total_bytes", "Spazio totale", "mdi:harddisk", UnitOfInformation.BYTES, SensorStateClass.MEASUREMENT),
    ("storage_free", "storage", "free_bytes", "Spazio libero", "mdi:harddisk", UnitOfInformation.BYTES, SensorStateClass.MEASUREMENT),
    ("storage_used", "storage", "used_bytes", "Spazio utilizzato", "mdi:database", UnitOfInformation.BYTES, SensorStateClass.MEASUREMENT),
    ("documents_count", "documents", "count", "Numero allegati", "mdi:file-multiple-outline", None, SensorStateClass.MEASUREMENT),
    ("documents_bytes", "documents", "bytes", "Dimensione allegati", "mdi:file-document-outline", UnitOfInformation.BYTES, SensorStateClass.MEASUREMENT),
    ("jobs_queued", "jobs", "queued", "Processi in coda", "mdi:progress-clock", None, SensorStateClass.MEASUREMENT),
    ("jobs_running", "jobs", "running", "Processi in esecuzione", "mdi:progress-wrench", None, SensorStateClass.MEASUREMENT),
    ("jobs_done", "jobs", "done", "Processi completati", "mdi:check-circle-outline", None, SensorStateClass.MEASUREMENT),
    ("jobs_failed", "jobs", "failed", "Processi in errore", "mdi:alert-circle-outline", None, SensorStateClass.MEASUREMENT),
    ("ocr_queued", "jobs", "ocr_queued", "OCR in coda", "mdi:text-box-search-outline", None, SensorStateClass.MEASUREMENT),
    ("ocr_running", "jobs", "ocr_running", "OCR in elaborazione", "mdi:text-box-check-outline", None, SensorStateClass.MEASUREMENT),
    ("ocr_failed", "jobs", "ocr_failed", "OCR in errore", "mdi:text-box-remove-outline", None, SensorStateClass.MEASUREMENT),
]


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(GestioneCCSensor(coordinator, entry, *description) for description in SENSORS)


class GestioneCCSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, entry, key, section, field, name, icon, unit, state_class):
        super().__init__(coordinator)
        self._key = key
        self._section = section
        self._field = field
        self._attr_name = f"Gestione C/C {name}"
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_suggested_object_id = f"gestione_cc_{key}"
        self._attr_icon = icon
        self._attr_native_unit_of_measurement = unit
        self._attr_state_class = state_class
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "Gestione C/C",
            "manufacturer": "Gestione C/C",
            "model": "Server locale",
        }

    @property
    def native_value(self):
        data = self.coordinator.data or {}
        return data.get(self._section, {}).get(self._field)
