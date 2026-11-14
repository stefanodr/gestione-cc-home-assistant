import asyncio
import ssl
from datetime import timedelta

import aiohttp
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import API_ENDPOINTS, COMMANDS, DEFAULT_SCAN_INTERVAL, DOMAIN


class GestioneCCCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry):
        self.base_url = entry.data["url"].rstrip("/")
        self.token = entry.data["token"]
        self.ssl_context = ssl.create_default_context(cafile=entry.data["ca_cert_path"])
        self.session = __import__(
            "homeassistant.helpers.aiohttp_client", fromlist=["async_get_clientsession"]
        ).async_get_clientsession(hass)
        super().__init__(
            hass,
            logger=__import__("logging").getLogger(__name__),
            name=DOMAIN,
            update_interval=DEFAULT_SCAN_INTERVAL,
        )

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
        try:
            keys = list(API_ENDPOINTS)
            values = await asyncio.gather(*(self._get(API_ENDPOINTS[key]) for key in keys))
            return dict(zip(keys, values))
        except (aiohttp.ClientError, TimeoutError, ssl.SSLError, ValueError) as error:
            raise UpdateFailed(f"Connessione Gestione C/C non disponibile: {type(error).__name__}") from error

    async def async_command(self, command):
        endpoint = COMMANDS[command]
        async with self.session.post(
            f"{self.base_url}/api/integration/v1/{endpoint}",
            headers={"Authorization": f"Bearer {self.token}"},
            json={},
            ssl=self.ssl_context,
            timeout=aiohttp.ClientTimeout(total=120),
        ) as response:
            payload = await response.json()
            if response.status >= 400:
                raise UpdateFailed(payload.get("code", payload.get("error", "Comando non riuscito")))
            await self.async_request_refresh()
            return payload
