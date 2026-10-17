"""Check deployed HTTPS headers and the HTTP redirect: python scripts/check_security_headers.py URL."""
import re
import sys
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen


def validate_headers(headers):
    headers = {key.lower(): value for key, value in headers.items()}
    csp = headers.get('content-security-policy', '')
    directives = dict((parts[0], parts[1:]) for directive in csp.split(';')
                      if (parts := directive.split()))
    errors = []
    for name, expected in [('default-src', ["'none'"]), ('script-src', ["'self'"]),
                           ('object-src', ["'none'"]), ('base-uri', ["'none'"]),
                           ('form-action', ["'none'"]), ('frame-ancestors', ["'self'"])]:
        if directives.get(name) != expected:
            errors.append(f'CSP {name}: expected {" ".join(expected)}')
    hsts = re.search(r'(?:^|;)\s*max-age=(\d+)', headers.get('strict-transport-security', ''), re.I)
    if not hsts or int(hsts.group(1)) < 31536000:
        errors.append('HSTS: expected max-age of at least 31536000')
    for name, value in [('x-content-type-options', 'nosniff'), ('x-frame-options', 'SAMEORIGIN'),
                        ('referrer-policy', 'strict-origin-when-cross-origin')]:
        if headers.get(name, '').lower() != value.lower():
            errors.append(f'{name}: expected {value}')
    if not headers.get('permissions-policy'):
        errors.append('Permissions-Policy missing')
    return errors


def main(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError('Use an HTTPS URL without credentials')
    for scheme in ('http', 'https'):
        target = urlunsplit(parsed._replace(scheme=scheme, fragment=''))
        with urlopen(Request(target, method='HEAD'), timeout=20) as response:
            final = urlsplit(response.url)
            if final.scheme != 'https' or final.netloc != parsed.netloc:
                raise ValueError(f'{scheme.upper()} request did not reach the expected HTTPS host')
            if errors := validate_headers(response.headers):
                raise ValueError('; '.join(errors))
        print(f'{scheme.upper()}: HTTPS and security headers verified')


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except (IndexError, ValueError, OSError) as error:
        print(f'Security verification failed: {error}', file=sys.stderr)
        sys.exit(1)
