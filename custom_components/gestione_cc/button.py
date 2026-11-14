from homeassistant.components.button import ButtonEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


BUTTONS = [
    ("local_backup", "Backup locale", "mdi:backup-restore"),
    ("google_drive_backup", "Backup Google Drive", "mdi:cloud-upload-outline"),
    ("integrity_check", "Controllo integrità database", "mdi:database-check"),
]


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(GestioneCCButton(coordinator, entry, *item) for item in BUTTONS)


class GestioneCCButton(CoordinatorEntity, ButtonEntity):
    def __init__(self, coordinator, entry, command, name, icon):
        super().__init__(coordinator)
        self._command = command
        self._attr_name = f"Gestione C/C {name}"
        self._attr_unique_id = f"{entry.entry_id}_{command}"
        self._attr_suggested_object_id = f"gestione_cc_{command}"
        self._attr_icon = icon
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": "Gestione C/C",
            "manufacturer": "Gestione C/C",
            "model": "Server locale",
        }

    async def async_press(self):
        await self.coordinator.async_command(self._command)
