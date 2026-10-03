"""Build small, reproducible extension archives. No dependencies or network access."""
import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = ('core.js', 'content.js', 'content.css')
BROWSERS = ('chromium', 'firefox', 'safari')

def package(browser, output):
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    if browser == 'firefox':
        manifest['browser_specific_settings'] = {'gecko': {
            'id': 'speedflow@priyanshubuild.github.io',
            'strict_min_version': '140.0',
            'data_collection_permissions': {'required': ['none']},
        }, 'gecko_android': {'strict_min_version': '142.0'}}
    output.mkdir(parents=True, exist_ok=True)
    folder = output / f'speedflow-{browser}'
    folder.mkdir(exist_ok=True)
    # Remove UI assets retired in 3.1 from previous generated unpacked packages.
    for retired in ('popup.html', 'popup.js', 'popup.css', 'docs/player-preview.jpg'):
        (folder / retired).unlink(missing_ok=True)
    assets = {name: (ROOT / name).read_bytes() for name in FILES}
    assets.update({str(path.relative_to(ROOT)): path.read_bytes() for path in sorted((ROOT / 'icons').glob('*.png'))})
    assets['manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    assets['README.md'] = (ROOT / 'README.md').read_bytes()
    for name in ('docs/front-controls.jpg', 'docs/VALIDATION.md'):
        assets[name] = (ROOT / name).read_bytes()
    archive = output / f'speedflow-{browser}-{manifest["version"]}.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
        for name, data in sorted(assets.items()):
            destination = folder / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, data)
    print(f'{browser}: {archive} ({archive.stat().st_size:,} bytes)')
    return archive

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=(*BROWSERS, 'all'), default='all')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    for browser in BROWSERS if args.browser == 'all' else (args.browser,):
        package(browser, args.output.resolve())
