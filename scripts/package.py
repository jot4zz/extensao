"""Create a Chrome/Edge ZIP with runtime files only, using Python's standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text())
output = root / 'dist' / f'texto-certo-{manifest["version"]}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    runtime_files = [root / 'manifest.json', root / 'README.md', *sorted((root / 'src').glob('*')), *sorted((root / 'icons').glob('*.png')), *sorted((root / 'vendor').glob('*'))]
    for path in runtime_files:
        archive.write(path, path.relative_to(root))
print(output)
source = output.with_name(f'texto-certo-fonte-{manifest["version"]}.zip')
with ZipFile(source, 'w', ZIP_DEFLATED) as archive:
    for path in [*runtime_files, root / 'package.json', root / 'package-lock.json', root / '.gitignore', *sorted((root / 'scripts').glob('*')), *sorted((root / 'tests').glob('*')), *sorted((root / 'licenses').glob('*'))]:
        if path.is_file():
            archive.write(path, path.relative_to(root))
print(source)
