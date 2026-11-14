from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


ENTITIES = [
    ("app_online", "health", "available", "Applicazione online", "mdi:server"),
    ("database_integrity", "database", "last_check_ok", "Database integro", "mdi:database-check"),
    ("google_drive_connected", "backups", "drive_connected", "Google Drive collegato", "mdi:cloud-check"),
]


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(GestioneCCBinarySensor(coordinator, entry, *item) for item in ENTITIES)


class GestioneCCBinarySensor(CoordinatorEntity, BinarySensorEntity):
    def __init__(self, coordinator, entry, key, section, field, name, icon):
        super().__init__(coordinator)
        self._section = section
        self._field = field
        self._attr_name = f"Gestione C/C {name}"
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_icon = icon
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "Gestione C/C",
            "manufacturer": "Gestione C/C",
            "model": "Server locale",
        }

    @property
    def is_on(self):
        value = (self.coordinator.data or {}).get(self._section, {}).get(self._field)
        return value if isinstance(value, bool) else None

    @property
    def available(self):
        return super().available and (self._section in (self.coordinator.data or {}))
