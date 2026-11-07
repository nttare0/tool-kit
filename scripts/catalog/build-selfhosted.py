"""Build a deterministic 1,000-tool supplement from a pinned upstream checkout.
Usage: python -m pip install --target /tmp/catalog-yaml PyYAML
PYTHONPATH=/tmp/catalog-yaml python scripts/catalog/build-selfhosted.py /path/to/extracted/source
The upstream tree must match SOURCE_COMMIT. Network fetching is intentionally separate.
"""
import collections
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import yaml

SOURCE_COMMIT = '80a6ccd60c105a81f7a02b9b731922e76f2aae48'
SOURCE = 'https://github.com/awesome-selfhosted/awesome-selfhosted-data'
ROOT = Path(__file__).resolve().parents[2]

def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().strip()).strip('-')

def identity(value):
    url = urlsplit(value)
    host = (url.hostname or '').lower().removeprefix('www.')
    return host + url.path.rstrip('/').lower()

def category(tags):
    text = ' '.join(tags).lower()
    if 'artificial intelligence' in text: return 'AI & Assistants'
    if any(t in text for t in ['media', 'photo', 'video surveillance']): return 'Media'
    if 'games' in text: return 'Games'
    if any(t in text for t in ['communication', 'groupware']): return 'Communication'
    if any(t in text for t in ['file transfer', 'archiving']): return 'Files & Storage'
    if any(t in text for t in ['money', 'e-commerce', 'inventory', 'resource planning', 'customer relationship', 'human resources', 'manufacturing', 'ticketing']): return 'Business & Finance'
    if any(t in text for t in ['document management', 'knowledge', 'wikis', 'learning', 'feed readers']): return 'Knowledge & Learning'
    if any(t in text for t in ['content management', 'blogging', 'url shorteners']): return 'Web & Publishing'
    if any(t in text for t in ['self-hosting', 'web servers', 'network', 'proxy', 'dns', 'remote access', 'password managers']): return 'Infrastructure'
    if any(t in text for t in ['software development', 'database']): return 'Development'
    if any(t in text for t in ['internet of things', 'recipe', 'health', 'genealogy', 'maps', 'travel', 'agriculture']): return 'Home & Lifestyle'
    return 'Productivity'

source = Path(sys.argv[1])
starter = json.loads((ROOT/'artifacts/api-server/src/data/tool-catalog.json').read_text())
slugs = {slug(t['name']) for t in starter}
urls = {identity(t['websiteUrl']) for t in starter}
rows = []
for file in sorted((source/'software').glob('*.yml')):
    item = yaml.safe_load(file.read_text())
    name = item.get('name', '').strip()
    url = item.get('website_url', '').strip()
    desc = item.get('description', '').strip()
    parsed = urlsplit(url)
    if item.get('archived') or not name or len(desc) < 20: continue
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password: continue
    if re.search(r'\b(nsfw|porn|adult content)\b', name+' '+desc, re.I): continue
    rows.append((item, file.name))
rows.sort(key=lambda entry: (-int(entry[0].get('stargazers_count') or 0), entry[0]['name'].lower()))
selected = []
for item, filename in rows:
    name, url = item['name'].strip(), item['website_url'].strip()
    if not slug(name) or slug(name) in slugs or identity(url) in urls: continue
    slugs.add(slug(name)); urls.add(identity(url))
    selected.append({
        'name': name, 'websiteUrl': url, 'shortDescription': item['description'].strip(),
        'category': category(item.get('tags', [])), 'tags': item.get('tags', []),
        'softwareLicenses': item.get('licenses', []),
        'sourceCodeUrl': item.get('source_code_url'),
        'sourceUrl': f'{SOURCE}/blob/{SOURCE_COMMIT}/software/{filename}',
    })
    if len(selected) == 1000: break
assert len(selected) == 1000, len(selected)
output = {
    'source': SOURCE, 'sourceCommit': SOURCE_COMMIT,
    'attribution': 'Awesome-Selfhosted contributors',
    'license': 'CC-BY-SA-3.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/3.0/',
    'changes': 'Selected 1,000 non-archived entries, omitted duplicates from the starter catalog, and mapped upstream tags to Toolstack categories. Upstream descriptions retained.',
    'tools': selected,
}
(ROOT/'artifacts/api-server/src/data/additional-tool-catalog.json').write_text(json.dumps(output, indent=2, ensure_ascii=False)+'\n')
for name in ['LICENSE', 'AUTHORS']:
    (ROOT/f'docs/licenses/awesome-selfhosted-{name}').write_bytes((source/name).read_bytes())
print('Selected:', len(selected))
print('Categories:', dict(collections.Counter(t['category'] for t in selected)))
