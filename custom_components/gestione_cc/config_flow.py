from functools import partial
import logging
from pathlib import Path
import ipaddress
import ssl
from urllib.parse import urlparse

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_URL
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers import selector

from .const import CONF_CA_CERT, DEFAULT_CA_CERT, DOMAIN

_LOGGER = logging.getLogger(__name__)


def _valid_local_https_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return False
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        return False
    host = parsed.hostname.lower()
    try:
        address = ipaddress.ip_address(host)
        return address.is_private and not address.is_loopback and not address.is_link_local
    except ValueError:
        return host == "homeassistant.local" or host.endswith((".local", ".lan", ".home", ".internal"))


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
            else:
                try:
                    # File access and certificate parsing are blocking operations:
                    # run both in the executor, never on Home Assistant's event loop.
                    ca_exists = await self.hass.async_add_executor_job(
                        partial(Path(ca_path).is_file)
                    )
                    if not ca_exists:
                        _LOGGER.warning("Configuration test failed: CA file is missing or unreadable")
                        errors["base"] = "ca_file_missing"
                    else:
                        context = await self.hass.async_add_executor_job(
                            partial(ssl.create_default_context, cafile=ca_path)
                        )
                        session = async_get_clientsession(self.hass)
                        async with session.get(
                            f"{url}/api/integration/v1/health",
                            headers={"Authorization": f"Bearer {token}"},
                            ssl=context,
                            timeout=aiohttp.ClientTimeout(total=10),
                        ) as response:
                            if response.status == 401:
                                _LOGGER.warning("Configuration test failed: API returned HTTP 401 (invalid token)")
                                errors["base"] = "invalid_auth"
                            elif response.status != 200:
                                _LOGGER.warning("Configuration test failed: API returned HTTP %s", response.status)
                                errors["base"] = "cannot_connect"
                            else:
                                payload = await response.json()
                                if not isinstance(payload, dict) or payload.get("available") is not True:
                                    _LOGGER.warning("Configuration test failed: API health response is invalid")
                                    errors["base"] = "invalid_response"
                                else:
                                    await self.async_set_unique_id(url.lower())
                                    self._abort_if_unique_id_configured()
                                    return self.async_create_entry(
                                        title="Gestione C/C",
                                        data={CONF_URL: url, "token": token, CONF_CA_CERT: ca_path},
                                    )
                except (aiohttp.ClientError, TimeoutError, OSError, ssl.SSLError, ValueError) as err:
                    # Never log user_input, request headers, or the bearer token.
                    _LOGGER.warning(
                        "Configuration connection test failed (%s): %s",
                        type(err).__name__,
                        err,
                    )
                    errors["base"] = "cannot_connect"

        schema = vol.Schema({
            vol.Required(CONF_URL): str,
            vol.Required("token"): selector.TextSelector(
                selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
            ),
            vol.Required(CONF_CA_CERT, default=DEFAULT_CA_CERT): str,
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
