"""Build an isolated app copy. Never modify the installed app or chat storage."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct

MODULE = 'local-conversation-thread-81abf71c800a.js'
EXPECTED = '76c672d98fef445bc62c262d8e7ad357d15a4a6c8b15c449b92159b5e845959e'
ANCHOR = 'let nt=I(),rt=Ot(),it=jA(q),at='
INSERT = """if(W!=null&&W===ce)regularTabsBind({id:W,hostId:q,getPath:()=>P.value.pathname,open:async item=>{let existing=Oc(P,`sidechat:${item.id}`);if(existing!=null){$d(P,existing,`sidechat:${item.id}`);return item.id;}let result=await Fg(P,zI,{attachedConversationId:item.id,sourceConversationId:W,hostId:item.hostId??q,cwd:null,collaborationMode:null,displayTitle:item.title,intl:P.get(fd),target:`right`,confirmBeforeClose:!1});if(result==null)throw Error(`The native panel is unavailable for this chat.`);return result;}});let nt=I(),rt=Ot(),it=jA(q),at="""


def digest(data): return hashlib.sha256(data).hexdigest()

def build(source, output):
    archive = source / 'resources/app.asar'
    with archive.open('rb') as f:
        prefix = f.read(16)
        _, header_size, _, json_size = struct.unpack('<4I', prefix)
        original_header = f.read(json_size)
        header = json.loads(original_header)
        base = 8 + header_size
        entry = header['files']['webview']['files']['assets']['files'][MODULE]
        f.seek(base + int(entry['offset']))
        original = f.read(entry['size'])
    if digest(original) != EXPECTED:
        raise RuntimeError('Unsupported app build: renderer hash differs. No files modified.')
    code = original.decode('utf-8')
    if code.count(ANCHOR) != 1: raise RuntimeError('Ambiguous patch anchor')
    patched = (code.replace(ANCHOR, INSERT, 1) + '\n' + Path(__file__).with_name('tabs.js').read_text(encoding='utf-8')).encode('utf-8')
    if output.exists() and not (output / '.regular-split-copy').exists(): raise RuntimeError('Output exists and is not a managed mod copy.')
    print('Copying app into isolated output...', flush=True)
    if not output.exists():
        shutil.copytree(source, output)
        (output / '.regular-split-copy').write_text('Local mod copy; installed app unchanged.\n')
    offset, old_size = int(entry['offset']), entry['size']
    delta = len(patched) - old_size
    def shift(tree):
        for value in tree.get('files', {}).values():
            if 'files' in value: shift(value)
            elif 'offset' in value and int(value['offset']) > offset:
                value['offset'] = str(int(value['offset']) + delta)
    shift(header)
    entry['size'] = len(patched)
    block = entry['integrity']['blockSize']
    entry['integrity']['hash'] = digest(patched)
    entry['integrity']['blocks'] = [digest(patched[i:i+block]) for i in range(0,len(patched),block)]
    raw = json.dumps(header, separators=(',', ':'), ensure_ascii=False).encode()
    executable = (source / 'ChatGPT.exe').read_bytes()
    old_hash = digest(original_header).encode('ascii')
    if executable.count(old_hash) != 1:
        raise RuntimeError('Expected exactly one archive hash in the runtime executable.')
    payload_size = (4 + len(raw) + 3) // 4 * 4
    prefix = struct.pack('<4I', 4, payload_size + 4, payload_size, len(raw))
    dest = output / 'resources/app.asar'
    with archive.open('rb') as src, dest.open('wb') as dst:
        dst.write(prefix); dst.write(raw); dst.write(b'\0' * (payload_size - 4 - len(raw)))
        src.seek(base)
        remaining = offset
        while remaining:
            chunk = src.read(min(8*1024*1024, remaining))
            if not chunk: raise RuntimeError('Truncated archive')
            dst.write(chunk); remaining -= len(chunk)
        dst.write(patched); src.seek(base + offset + old_size)
        shutil.copyfileobj(src, dst, 8*1024*1024)
    # Keep archive integrity enforcement enabled, with the rebuilt archive hash.
    # Editing a locally copied executable invalidates its vendor signature.
    (output / 'ChatGPT.exe').write_bytes(executable.replace(old_hash, digest(raw).encode('ascii'), 1))
    (Path(__file__).parent / 'patched-module.mjs').write_bytes(patched)
    print(f'Built {dest}. Installed app is unchanged. Runtime verification still required.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    build(args.source.resolve(), args.output.resolve())
