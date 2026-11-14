from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from homeassistant.const import UnitOfInformation
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


DATA_SIZE_SENSORS = {
    "database_size",
    "storage_total",
    "storage_free",
    "storage_used",
    "documents_bytes",
}

SENSORS = [
    ("app_version", "health", "app_version", "Versione applicazione", "mdi:tag-outline", None, None),
    ("addon_version", "health", "addon_version", "Versione add-on", "mdi:puzzle-outline", None, None),
    ("uptime", "health", "uptime_seconds", "Tempo attività", "mdi:timer-outline", None, SensorStateClass.MEASUREMENT),
    ("database_size", "database", "size_bytes", "Dimensione database", "mdi:database", UnitOfInformation.MEGABYTES, SensorStateClass.MEASUREMENT),
    ("database_last_write", "database", "last_write_at", "Ultima modifica database", "mdi:database-clock", None, None),
    ("database_last_check", "database", "last_check_at", "Ultimo controllo integrità", "mdi:database-check", None, None),
    ("backup_local_count", "backups", "local_count", "Copie backup locali", "mdi:backup-restore", None, SensorStateClass.MEASUREMENT),
    ("backup_local_last", "backups", "local_last_at", "Ultimo backup locale", "mdi:clock-check-outline", None, None),
    ("backup_drive_last", "backups", "drive_last_at", "Ultimo backup Google Drive", "mdi:cloud-check-outline", None, None),
    ("storage_total", "storage", "total_bytes", "Spazio totale", "mdi:harddisk", UnitOfInformation.MEGABYTES, SensorStateClass.MEASUREMENT),
    ("storage_free", "storage", "free_bytes", "Spazio libero", "mdi:harddisk", UnitOfInformation.MEGABYTES, SensorStateClass.MEASUREMENT),
    ("storage_used", "storage", "used_bytes", "Spazio utilizzato", "mdi:database", UnitOfInformation.MEGABYTES, SensorStateClass.MEASUREMENT),
    ("documents_count", "documents", "count", "Numero allegati", "mdi:file-multiple-outline", None, SensorStateClass.MEASUREMENT),
    ("documents_bytes", "documents", "bytes", "Dimensione allegati", "mdi:file-document-outline", UnitOfInformation.MEGABYTES, SensorStateClass.MEASUREMENT),
    ("jobs_queued", "jobs", "queued", "Processi in coda", "mdi:progress-clock", None, SensorStateClass.MEASUREMENT),
    ("jobs_running", "jobs", "running", "Processi in esecuzione", "mdi:progress-wrench", None, SensorStateClass.MEASUREMENT),
    ("jobs_done", "jobs", "done", "Processi completati", "mdi:check-circle-outline", None, SensorStateClass.MEASUREMENT),
    ("jobs_failed", "jobs", "failed", "Processi in errore", "mdi:alert-circle-outline", None, SensorStateClass.MEASUREMENT),
    ("ocr_queued", "jobs", "ocr_queued", "OCR in coda", "mdi:text-box-search-outline", None, SensorStateClass.MEASUREMENT),
    ("ocr_running", "jobs", "ocr_running", "OCR in elaborazione", "mdi:text-box-check-outline", None, SensorStateClass.MEASUREMENT),
    ("ocr_failed", "jobs", "ocr_failed", "OCR in errore", "mdi:text-box-remove-outline", None, SensorStateClass.MEASUREMENT),
]


def _refresh_existing_data_size_units(hass, entry):
    """Refresh the initial display unit for existing data-size sensors.

    Home Assistant stores the initially suggested sensor unit in the entity
    registry. The refresh flag asks SensorEntity to recalculate that stored
    suggestion using _attr_suggested_unit_of_measurement below.
    """
    registry = er.async_get(hass)
    for registry_entry in er.async_entries_for_config_entry(registry, entry.entry_id):
        if registry_entry.domain != "sensor" or registry_entry.platform != DOMAIN:
            continue
        if not any(registry_entry.unique_id.endswith(f"_{key}") for key in DATA_SIZE_SENSORS):
            continue

        # Respect an explicit unit selected by the user in the entity options.
        user_options = registry_entry.options.get("sensor", {})
        if "unit_of_measurement" in user_options:
            continue

        private_options = registry_entry.options.get("sensor.private", {})
        if private_options.get("suggested_unit_of_measurement") == UnitOfInformation.MEGABYTES:
            continue

        registry.async_update_entity_options(
            registry_entry.entity_id,
            "sensor.private",
            {"refresh_initial_entity_options": True},
        )


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    _refresh_existing_data_size_units(hass, entry)
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
        if key in DATA_SIZE_SENSORS:
            self._attr_device_class = SensorDeviceClass.DATA_SIZE
            self._attr_suggested_unit_of_measurement = UnitOfInformation.MEGABYTES
            self._attr_suggested_display_precision = 2
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "Gestione C/C",
            "manufacturer": "Gestione C/C",
            "model": "Server locale",
        }

    @property
    def native_value(self):
        data = self.coordinator.data or {}
        value = data.get(self._section, {}).get(self._field)
        if value is None:
            return None
        if self._key in DATA_SIZE_SENSORS:
            try:
                return round(float(value) / 1_000_000, 2)
            except (TypeError, ValueError):
                return None
        return value
