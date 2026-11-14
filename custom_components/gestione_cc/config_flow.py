from pathlib import Path
import ipaddress
import ssl
from urllib.parse import urlparse

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_URL
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_CA_CERT, DEFAULT_CA_CERT, DOMAIN


def _valid_local_https_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return False
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        return False
    host = parsed.hostname.lower()
    try:
        address = ipaddress.ip_address(host)
        return address.is_private or address.is_loopback
    except ValueError:
        return host in ("localhost", "homeassistant.local") or host.endswith((".local", ".lan", ".home", ".internal"))


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            url = user_input[CONF_URL].strip().rstrip("/")
            token = user_input["token"].strip()
            ca_path = user_input[CONF_CA_CERT].strip()
            if not _valid_local_https_url(url):
                errors["base"] = "invalid_local_url"
            elif not token or len(token) > 256:
                errors["base"] = "invalid_token"
            elif not Path(ca_path).is_file():
                errors["base"] = "ca_file_missing"
            else:
                try:
                    context = ssl.create_default_context(cafile=ca_path)
                    session = async_get_clientsession(self.hass)
                    async with session.get(
                        f"{url}/api/integration/v1/health",
                        headers={"Authorization": f"Bearer {token}"},
                        ssl=context,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status == 401:
                            errors["base"] = "invalid_auth"
                        elif response.status != 200:
                            errors["base"] = "cannot_connect"
                        else:
                            payload = await response.json()
                            if payload.get("available") is not True:
                                errors["base"] = "invalid_response"
                            else:
                                await self.async_set_unique_id(url.lower())
                                self._abort_if_unique_id_configured()
                                return self.async_create_entry(
                                    title="Gestione C/C",
                                    data={CONF_URL: url, "token": token, CONF_CA_CERT: ca_path},
                                )
                except (aiohttp.ClientError, TimeoutError, OSError, ssl.SSLError, ValueError):
                    errors["base"] = "cannot_connect"

        schema = vol.Schema({
            vol.Required(CONF_URL): str,
            vol.Required("token"): str,
            vol.Required(CONF_CA_CERT, default=DEFAULT_CA_CERT): str,
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
