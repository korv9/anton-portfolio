"""Public JobSearch text projection and conservative, sentence-bound requirements."""
from datetime import datetime, time, timezone
from html import unescape
from html.parser import HTMLParser
import ipaddress
import re
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

VERSION = 'job-requirements-v5'
SKILLS = {
    'Python': ('language', r'\bpython\b'), 'SQL': ('database', r'\bsql\b'),
    'Java': ('language', r'\bjava\b'), 'JavaScript': ('language', r'\bjavascript\b'),
    'TypeScript': ('language', r'\btypescript\b'), 'C#': ('language', r'(?<!\w)c#'),
    'C++': ('language', r'(?<!\w)c\+\+'), 'Go': ('language', r'\bgolang\b'),
    '.NET': ('framework', r'(?<!\w)\.net\b'), 'React': ('framework', r'\breact(?:\.js)?\b'),
    'Angular': ('framework', r'\bangular\b'), 'Django': ('framework', r'\bdjango\b'),
    'Spring': ('framework', r'\bspring(?: boot)?\b'), 'Node.js': ('framework', r'\bnode\.?js\b'),
    'Azure': ('cloud', r'\bazure\b'), 'AWS': ('cloud', r'\baws\b|amazon web services'),
    'Google Cloud': ('cloud', r'\bgcp\b|google cloud'),
    'PostgreSQL': ('database', r'\bpostgres(?:ql)?\b'), 'MongoDB': ('database', r'\bmongodb\b'),
    'Databricks': ('platform', r'\bdatabricks\b'), 'Docker': ('platform', r'\bdocker\b'),
    'Kubernetes': ('platform', r'\bkubernetes\b'), 'Power BI': ('platform', r'\bpower bi\b'),
    'CI/CD': ('practice', r'\bci\s*/\s*cd\b'), 'Git': ('practice', r'\bgit\b'),
    'PySpark': ('framework', r'\bpyspark\b'), 'Delta Lake': ('platform', r'\bdelta lake\b'),
    'dbt': ('platform', r'\bdbt(?: core)?\b'), 'DuckDB': ('database', r'\bduckdb\b'),
    'Parquet': ('platform', r'\bparquet\b'), 'ETL/ELT': ('practice', r'\betl\b|\belt\b'),
    'REST API': ('practice', r'\brest(?:ful)?[ -]+apis?\b'),
    'Databricks Workflows': ('platform', r'\bdatabricks workflows\b'),
    'data modeling': ('practice', r'\bdata model(?:l?ing)\b|datamodellering|stjärnschema|star schema'),
    'NLP': ('practice', r'\bnlp\b|natural language processing'), 'UMAP': ('practice', r'\bumap\b'),
    'HDBSCAN': ('practice', r'\bhdbscan\b'), 'sentence-transformers': ('framework', r'\bsentence[ -]transformers\b'),
    'MLflow': ('platform', r'\bmlflow\b'), 'DAX': ('language', r'\bdax\b'),
    'Microsoft Fabric': ('platform', r'\bmicrosoft fabric\b'), 'Cloudflare': ('cloud', r'\bcloudflare\b'),
    'GitHub Actions': ('practice', r'\bgithub actions\b'), 'Scala': ('language', r'\bscala\b'),
    'Rust': ('language', r'\brust\b'), 'Terraform': ('platform', r'\bterraform\b'), 'Linux': ('platform', r'\blinux\b'),
}
PREFERRED = r'meriterande|önskvärt|en fördel|ett plus|gärna|nice.to.have|preferred|a plus|an advantage'
REQUIRED = r'\bkrav\b|måste|du (?:ska|skall|har)|vi (?:kräver|söker dig som har)|required|must.have|you (?:must|have)|(?:minst|minimum|at least)\s+(?:\d+|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|one|two|three|four|five|six|seven|eight|nine|ten)\+?\s*(?:års?|years?|yrs?)'
# Swedish phone numbers: "070 123 45 67", "070.123.45.67", "073-123 45 67", "08-123 45 67", "+46 (0)70 123 45 67".
EMAIL = r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}'
PHONE = r'(?<!\w)(?:\+46[   ]*(?:\(0\))?[   .-]?|0)(?:\d[   .-]?){7,10}\d(?!\w)'
NEGATED = r'inget krav|inte ett krav|krävs inte|not required|not a requirement|no .{0,20}required'
# A heading that introduces requirements: "Krav:", "Vi söker dig som har:", "We believe you have:".
REQUIRED_HEADING = r'^\s*(?:krav|skallkrav|kvalifikationer|qualifications|requirements|must.have)\s*:?\s*$|(?:du|som|you)\s+(?:har|have)\s*:\s*$'
# Spoken languages other than the Swedish and English rule below, named as a skill to have.
LANGUAGES = (r'\b(?:spanska|spanish|tyska|german|franska|french|finska|finnish|norska|norwegian|danska|danish|'
             r'arabiska|arabic|polska|polish|italienska|italian|ryska|russian|kinesiska|chinese|mandarin|'
             r'japanska|japanese|portugisiska|portuguese|nederländska|dutch|turkiska|turkish)\b')
LANGUAGE_CONDITION = (rf'(?:flytande|fluent|proficien\w*|goda kunskaper i)\s+(?:\w+\s+(?:och|and)\s+)?{LANGUAGES}'
                      rf'|{LANGUAGES}[\w-]*\s+(?:i tal och skrift|speaking|written|spoken)')


class PlainHTML(HTMLParser):
    """Empty markup allowlist. Content is subsequently rendered only as text."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.hidden = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'iframe', 'object', 'template'):
            self.hidden += 1
        elif not self.hidden and tag in ('p', 'br', 'li', 'div', 'h1', 'h2', 'h3'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'iframe', 'object', 'template'):
            self.hidden = max(0, self.hidden - 1)
        elif not self.hidden and tag in ('p', 'li', 'div'):
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def public_url(value):
    if not isinstance(value, str) or re.search(r'[\s\x00-\x1f\\]', value):
        return None
    try:
        u = urlsplit(value)
        if u.scheme != 'https' or not u.hostname or u.username or u.password or u.port not in (None, 443):
            return None
        if u.hostname == 'localhost' or '.' not in u.hostname:
            return None
        try:
            if not ipaddress.ip_address(u.hostname).is_global:
                return None
        except ValueError:
            pass
        return value
    except ValueError:
        return None


def instant(value, *, deadline=False):
    try:
        d = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if deadline and len(value) == 10:
            d = datetime.combine(d.date(), time.max)
        return (d if d.tzinfo else d.replace(tzinfo=ZoneInfo('Europe/Stockholm'))).astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError):
        return None


def active(ad, at):
    deadline = instant(ad.get('application_deadline'), deadline=True)
    country = (ad.get('workplace_address') or {}).get('country_code')
    # JobSearch uses its legacy country taxonomy code 199 for Sverige, not ISO SE.
    return (ad.get('removed') is not True and country in (None, 'SE', '199')
            and (deadline is None or deadline >= at))


def redact(text):
    """(text with e-mail addresses and phone numbers replaced, how many were replaced)."""
    count = 0
    for pattern in (EMAIL, PHONE):
        text, n = re.subn(pattern, '[kontaktuppgift utelämnad]', text)
        count += n
    return text, count


def public_text(ad):
    description = ad.get('description') or {}
    text = description.get('text')
    origin = 'description.text'
    if not isinstance(text, str) or not text.strip():
        parser = PlainHTML()
        parser.feed(description.get('text_formatted') or '')
        text, origin = ''.join(parser.parts), 'description.text_formatted_as_text'
    # Retain wording and whitespace except disclosed contact redactions.
    text, count = redact(text)
    for contact in ad.get('application_contacts') or []:
        name = contact.get('name') if isinstance(contact, dict) else None
        if name and len(name) > 3:
            text, n = re.subn(r'(?<!\w)' + re.escape(name) + r'(?!\w)', '[kontaktperson utelämnad]', text)
            count += n
    return text, origin, count


def requirements(text, ad, skills=None):
    """skills: the vocabulary to read, {label: (kind, pattern)}; SKILLS unless a caller has a wider one."""
    skills = skills or SKILLS
    result, seen = [], set()
    heading = None
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            heading = None
            continue
        # A line that ends in a colon may be longer ("Det är ett plus om du har erfarenhet inom något av följande:").
        short_heading = ((len(line) < 65 and not re.search(r'[.!?]', line))
                         or (len(line) < 90 and line.rstrip().endswith(':')))
        if short_heading and (line.rstrip().endswith(':') or re.fullmatch(r'\s*(?:krav|skallkrav|kvalifikationer|qualifications|requirements|must.have|meriterande|preferred)\s*', line, re.I)):
            heading = ('preferred' if re.search(PREFERRED, line, re.I) else
                       'required' if re.search(REQUIRED_HEADING, line, re.I) else None)
        for sentence in re.split(r'(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÅÄÖ])', line):
            level = ('ambiguous' if re.search(NEGATED, sentence, re.I) else
                     # Under a "Meriterande:" heading, "du har ..." is still a merit.
                     'preferred' if heading == 'preferred' or re.search(PREFERRED, sentence, re.I) else
                     'required' if re.search(REQUIRED, sentence, re.I) else heading or 'ambiguous')
            observations = [(label, kind) for label, (kind, pattern) in skills.items() if re.search(pattern, sentence, re.I)]
            for kind, pattern in (
                ('seniority', r'\b(?:senior|junior|lead|principal)\b'),
                ('education', r'utbildning|examen|högskol|universitet|degree|bachelor|master|ph\.?d|doktor'),
                ('experience', r'\d+\s*(?:års?|years?)|erfarenhet|experience'),
                ('conditions', r'heltid|deltid|tillsvidare|visstid|provanställning|full.time|part.time'),
                ('conditions', r'personalansvar|people management|manage a team|ledarerfarenhet|medborgarskap|citizenship|säkerhetsprövning|security clearance|svenska.*(?:tal|skrift)|swedish.*(?:fluent|proficien)'),
                ('conditions', LANGUAGE_CONDITION),
                ('responsibilities', r'arbetsuppgifter|du kommer|ansvara|ansvarar|responsibilities|you will'),
                ('benefits', r'friskvård|förmåner|pension|benefits'),
            ):
                match = re.search(pattern, sentence, re.I)
                if match:
                    observations.append((match.group(), kind))
            for label, kind in observations:
                key = (label.casefold(), kind, level, sentence)
                if key not in seen:
                    result.append({'label': label, 'category': kind, 'strength': level,
                                   'source_field': 'description', 'line': line_number, 'quote': sentence})
                    seen.add(key)
    for key, strength in (('must_have', 'required'), ('nice_to_have', 'preferred')):
        for skill in (ad.get(key) or {}).get('skills') or []:
            if isinstance(skill, dict) and skill.get('label'):
                normalized = next((name for name, (_, pattern) in skills.items()
                    if re.search(pattern, skill['label'], re.I)), skill['label'])
                result.append({'label': normalized, 'category': 'structured_skill', 'strength': strength,
                               'source_field': key + '.skills', 'line': None, 'quote': skill['label']})
    return {'version': VERSION, 'requirements': result,
            'limitations': 'Sentence rules and official structured tags; unqualified mentions remain ambiguous. No LLM or suitability score.'}


def label(value):
    return value.get('label') if isinstance(value, dict) else value if isinstance(value, str) else None


def detail(ad, card):
    text, origin, redactions = public_text(ad)
    analysis = requirements(text, ad)
    remote = []
    for line in text.splitlines():
        if re.search(r'distans|hybrid|remote', line, re.I):
            remote.append(line)
    return {**{k: card[k] for k in ('job_id', 'document_hash', 'source_url')},
            'description_text': text, 'text_origin': origin, 'contact_redactions': redactions,
            'application_url': public_url((ad.get('application_details') or {}).get('url')),
            'employment_type': label(ad.get('employment_type')), 'working_hours': label(ad.get('working_hours_type')),
            'duration': label(ad.get('duration')), 'salary': (ad.get('salary_description') or None),
            'salary_type': label(ad.get('salary_type')), 'remote_evidence': remote,
            'analysis': analysis}


def package(ads, cards, generated_at, valid_until, registry_hash, *, remaining=False):
    by_id = {str(a['id']): a for a in ads}
    newest = sorted(cards, key=lambda c: c['job_id'])
    newest.sort(key=lambda c: instant(c['publication_date']), reverse=True)
    return {'schema_version': 1, 'state': 'available', 'generated_at': generated_at,
            'valid_until': valid_until, 'registry_hash': registry_hash,
            'selection': ('Remaining observed active Data/IT advertisements, fetched only when selected.' if remaining else
                'Latest 50 active Data/IT advertisements in the observed JobSearch window; publication instant descending, job_id ascending.'),
            'jobs': [detail(by_id[c['job_id']], c) for c in (newest[50:] if remaining else newest[:50])]}
