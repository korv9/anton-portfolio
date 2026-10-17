"""Bounded, serial HTTP access with robots checks before every target/redirect."""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit

import requests

from compliance_intelligence.authority_sources import official_url, source_spec
from lib.rawstore import USER_AGENT, sha256

LOG = logging.getLogger(__name__)
RETRYABLE = {429, 500, 502, 503, 504}
MAX_BYTES = 25 * 1024 * 1024


class AccessFailure(ValueError):
    def __init__(self, code, *, halt=False):
        super().__init__(code)
        self.code, self.halt = code, halt


class Robots:
    """RFC 9309 path wildcards and longest-match allow/disallow precedence."""
    def __init__(self, text, agent=USER_AGENT.split("/")[0]):
        groups, agents, rules, delays = [], [], [], []
        had_rules = False
        for line in text.splitlines():
            line = line.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = [s.strip() for s in line.split(":", 1)]
            key = key.lower()
            if key == "user-agent":
                if had_rules:
                    groups.append((agents, rules, delays))
                    agents, rules, delays, had_rules = [], [], [], False
                agents.append(value.lower())
            elif agents:
                had_rules = True
                if key in ("allow", "disallow") and value:
                    rules.append((key == "allow", value))
                if key == "crawl-delay":
                    try:
                        delay = float(value)
                        if not 0 <= delay < float("inf"):
                            raise ValueError("Invalid crawl delay")
                        delays.append(delay)
                    except ValueError as exc:
                        raise AccessFailure("robots_invalid_delay", halt=True) from exc
        groups.append((agents, rules, delays))
        matched = [g for g in groups if any(a != "*" and a in agent.lower() for a in g[0])]
        if matched:
            specificity = max(len(a) for g in matched for a in g[0] if a in agent.lower())
            matched = [g for g in matched if any(len(a) == specificity and a in agent.lower() for a in g[0])]
        else:
            matched = [g for g in groups if "*" in g[0]]
        self.rules = [r for _, rs, _ in matched for r in rs]
        self.delay = max([2.0] + [d for _, _, ds in matched for d in ds])

    def allowed(self, url):
        from urllib.parse import unquote
        p = urlsplit(url)
        target = p.path + ("?" + p.query if p.query else "")
        # Check both encodings conservatively; encoded blocked queries stay blocked.
        for candidate in {target, unquote(target)}:
            matches = []
            for allow, pattern in self.rules:
                anchored = pattern.endswith("$")
                raw = pattern[:-1] if anchored else pattern
                regex = "^" + ".*".join(re.escape(s) for s in raw.split("*")) + ("$" if anchored else "")
                if re.search(regex, candidate):
                    matches.append((len(raw.replace("*", "")), allow))
            if matches and not max(matches)[1]:
                return False
        return True


class AuthorityHttp:
    def __init__(self, source, record_attempt, record_robots, *, session=None, sleep=time.sleep,
                 monotonic=time.monotonic, max_attempts=4):
        self.source, self.spec = source, source_spec(source)
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,text/plain"})
        self.record_attempt, self.record_robots = record_attempt, record_robots
        self.sleep, self.monotonic, self.max_attempts = sleep, monotonic, max_attempts
        self.last_request = None
        self.robots = None

    def close(self):
        self.session.close()

    def request(self, url, headers=None):
        delay = self.robots.delay if self.robots else 2.0
        if delay > 60:
            raise AccessFailure("crawl_delay_requires_later_run", halt=True)
        for attempt in range(1, self.max_attempts + 1):
            if self.last_request is not None:
                self.sleep(max(0.0, delay - (self.monotonic() - self.last_request)))
            self.last_request = self.monotonic()
            status, metadata = None, {}
            try:
                with self.session.get(url, headers=headers or {}, timeout=(15, 45),
                                      allow_redirects=False, stream=True) as response:
                    status = response.status_code
                    metadata = {k.lower(): v for k, v in response.headers.items() if k.lower() in (
                        "content-type", "etag", "last-modified", "date", "retry-after", "location", "content-language")}
                    if status in (401, 403):
                        raise AccessFailure("http_" + str(status), halt=True)
                    if status == 429:
                        raise AccessFailure("http_429")
                    if status in RETRYABLE:
                        raise AccessFailure("http_" + str(status))
                    if status not in (200, 304, 301, 302, 303, 307, 308, 404, 410):
                        raise AccessFailure("http_" + str(status))
                    data = bytearray()
                    for chunk in response.iter_content(65536):
                        data.extend(chunk)
                        if len(data) > MAX_BYTES:
                            raise AccessFailure("response_size_limit")
                self.record_attempt(url, status, attempt, metadata, None)
                return status, metadata, bytes(data)
            except (requests.RequestException, AccessFailure) as exc:
                code = exc.code if isinstance(exc, AccessFailure) else "network_" + type(exc).__name__
                self.record_attempt(url, status, attempt, metadata, code)
                LOG.warning("source=%s attempt=%s status=%s error=%s", self.source, attempt, status, code)
                halt = isinstance(exc, AccessFailure) and exc.halt
                if halt or (status is not None and status not in RETRYABLE) or attempt == self.max_attempts:
                    raise AccessFailure(code, halt=halt or status == 429) from None
                wait = 2.0 ** attempt
                if metadata.get("retry-after"):
                    try:
                        value = metadata["retry-after"]
                        after = float(value) if value.isdigit() else (
                            parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
                        wait = max(wait, after)
                    except (ValueError, TypeError, OverflowError):
                        pass
                if wait > 60:
                    raise AccessFailure("retry_after_requires_later_run", halt=True) from None
                self.sleep(wait)
        raise AccessFailure("retry_exhausted")

    def check_robots(self):
        url = self.spec["origin"] + "/robots.txt"
        status, headers, body = self.request(url)
        # Fail closed on redirects, missing policies, access errors and HTML challenges.
        if status != 200 or "text/plain" not in headers.get("content-type", "").lower():
            self.record_robots(url, status, sha256(body), None)
            raise AccessFailure("robots_unavailable", halt=True)
        self.robots = Robots(body.decode("utf-8-sig", errors="strict"))
        self.record_robots(url, status, sha256(body), {"rules": self.robots.rules, "delay": self.robots.delay})

    def get(self, url, validators=None):
        if self.robots is None:
            self.check_robots()
        visited = set()
        for _ in range(6):
            url = official_url(self.source, url)
            if url in visited:
                raise AccessFailure("redirect_cycle")
            visited.add(url)
            if not self.robots.allowed(url):
                self.record_attempt(url, None, 0, {}, "robots_disallowed")
                raise AccessFailure("robots_disallowed")
            status, metadata, body = self.request(url, validators)
            if status in (301, 302, 303, 307, 308):
                try:
                    url = official_url(self.source, urljoin(url, metadata["location"]))
                except (KeyError, ValueError):
                    raise AccessFailure("redirect_outside_source_or_invalid") from None
                validators = None
                continue
            if status in (404, 410):
                raise AccessFailure("http_" + str(status))
            return url, status, metadata, body
        raise AccessFailure("redirect_limit")
