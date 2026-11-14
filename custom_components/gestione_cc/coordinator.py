import asyncio
from functools import partial
import logging
import ssl
import time

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import API_ENDPOINTS, COMMANDS, DEFAULT_SCAN_INTERVAL, DOMAIN


class GestioneCCCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry):
        self.hass = hass
        self.base_url = entry.data["url"].rstrip("/")
        self.token = entry.data["token"]
        self.ca_path = entry.data["ca_cert_path"]
        self.ssl_context = None
        self.session = async_get_clientsession(hass)
        self._poll_cache = {}
        self._last_poll = {}
        super().__init__(
            hass,
            logger=logging.getLogger(__name__),
            name=DOMAIN,
            update_interval=DEFAULT_SCAN_INTERVAL,
        )

    async def async_initialize(self):
        """Load the CA certificate outside Home Assistant's event loop."""
        try:
            self.ssl_context = await self.hass.async_add_executor_job(
                partial(ssl.create_default_context, cafile=self.ca_path)
            )
        except (OSError, ssl.SSLError, ValueError) as error:
            raise UpdateFailed(
                f"Impossibile caricare il certificato CA Gestione C/C: {type(error).__name__}"
            ) from error

    async def _get(self, endpoint):
        async with self.session.get(
            f"{self.base_url}/api/integration/v1/{endpoint}",
            headers={"Authorization": f"Bearer {self.token}"},
            ssl=self.ssl_context,
            timeout=aiohttp.ClientTimeout(total=12),
        ) as response:
            if response.status == 401:
                raise UpdateFailed("Token Gestione C/C non valido o revocato")
            response.raise_for_status()
            payload = await response.json()
            if not isinstance(payload, dict):
                raise UpdateFailed("Risposta tecnica Gestione C/C non valida")
            return payload

    async def _async_update_data(self):
        intervals = {
            "health": 60,
            "database": 300,
            "backups": 300,
            "storage": 300,
            "documents": 120,
            "jobs": 120,
        }
        now = time.monotonic()
        due = [
            key for key in API_ENDPOINTS
            if key not in self._poll_cache or now - self._last_poll.get(key, 0) >= intervals[key]
        ]
        try:
            values = await asyncio.gather(*(self._get(API_ENDPOINTS[key]) for key in due))
            for key, value in zip(due, values):
                self._poll_cache[key] = value
                self._last_poll[key] = now
            return dict(self._poll_cache)
        except (aiohttp.ClientError, TimeoutError, ssl.SSLError, ValueError) as error:
            raise UpdateFailed(f"Connessione Gestione C/C non disponibile: {type(error).__name__}") from error

    async def async_command(self, command):
        endpoint = COMMANDS[command]
        async with self.session.post(
            f"{self.base_url}/api/integration/v1/{endpoint}",
            headers={"Authorization": f"Bearer {self.token}"},
            json={},
            ssl=self.ssl_context,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as response:
            payload = await response.json()
            if response.status >= 400:
                raise UpdateFailed(payload.get("code", payload.get("error", "Comando non riuscito")))
            self._last_poll.clear()
            await self.async_request_refresh()
            return payload
