#!/usr/bin/env python3
"""Converte os modelos .glb (Tripo/gltfpack, compressão EXT_meshopt) em versões leves para o jogo.

Para cada modelo:
  1. lê o GLB e decodifica os buffers comprimidos (meshopt: vértices v0 e índices v1);
  2. simplifica a malha por agrupamento de vértices (duas versões: perto e longe);
  3. reduz a textura de cor para 1024 px (JPEG);
  4. grava public/models/<nome>.bin (malhas) e public/models/<nome>.jpg (textura).

Uso: python3 tools/process_models.py <pasta com .glb> <pasta de saída>
"""
import json, struct, sys, os, io
import numpy as np
from PIL import Image

# ---------------- leitura do GLB ----------------
def read_glb(path):
    b = open(path, 'rb').read()
    magic, ver, length = struct.unpack('<4sII', b[:12])
    assert magic == b'glTF', 'não é GLB'
    off, js, binc = 12, None, None
    while off < len(b):
        cl, ct = struct.unpack('<I4s', b[off:off + 8])
        data = b[off + 8:off + 8 + cl]
        if ct == b'JSON': js = json.loads(data)
        elif ct == b'BIN\x00': binc = data
        off += 8 + cl
    return js, binc

# ---------------- meshopt: vértices (versão 0) ----------------
def unzigzag8(v):
    return ((-(v & 1)) ^ (v >> 1)) & 0xFF

def decode_bytes_group(data, pos, bits, out):
    if bits == 0:
        out.extend([0] * 16); return pos
    if bits == 3:
        out.extend(data[pos:pos + 16]); return pos + 16
    b = 2 if bits == 1 else 4
    packed = data[pos:pos + 16 * b // 8]; pos2 = pos + 16 * b // 8; esc = (1 << b) - 1
    for byte in packed:
        for sh in range(8 - b, -1, -b):
            enc = (byte >> sh) & esc
            if enc == esc: out.append(data[pos2]); pos2 += 1
            else: out.append(enc)
    return pos2

def decode_vertex_buffer(data, count, size):
    assert data[0] == 0xA0, 'versão do codec de vértices não suportada: %x' % data[0]
    block = min((8192 // size) & ~15, 256)
    last = bytearray(data[len(data) - size:])
    out = np.zeros((count, size), dtype=np.uint8)
    pos = 1
    for v0 in range(0, count, block):
        n = min(block, count - v0); aligned = (n + 15) & ~15
        for k in range(size):
            hsize = ((aligned // 16) + 3) // 4; header = data[pos:pos + hsize]; pos += hsize
            vals = []
            for g in range(aligned // 16):
                bits = (header[g // 4] >> ((g % 4) * 2)) & 3
                pos = decode_bytes_group(data, pos, bits, vals)
            enc = np.array(vals[:n], dtype=np.int32)
            dz = ((-(enc & 1)) ^ (enc >> 1)) & 0xFF                      # zigzag
            col = (np.cumsum(dz) + last[k]) & 0xFF                        # soma acumulada (delta por byte)
            out[v0:v0 + n, k] = col
            last[k] = int(col[-1])
    return out

def filter_exp(raw, size):
    v = raw.view('<i4').reshape(-1, size // 4).astype(np.int64)
    e = v >> 24
    m = ((v & 0xFFFFFF) ^ 0x800000) - 0x800000
    return (m.astype(np.float64) * np.power(2.0, e)).astype(np.float32)

# ---------------- meshopt: índices (versão 1) ----------------
def decode_index_buffer(data, index_count):
    assert (data[0] & 0xF0) == 0xE0, 'codec de índices inválido'
    version = data[0] & 0x0F
    out = np.zeros(index_count, dtype=np.uint32)
    ef = [[0, 0] for _ in range(16)]; vf = [0] * 16
    efo = 0; vfo = 0; nxt = 0; last = 0; fecmax = 13 if version >= 1 else 15
    code = 1; dp = 1 + index_count // 3; safe_end = len(data) - 16; aux = data[safe_end:]
    def vbyte(p):
        lead = data[p]; p += 1
        if lead < 128: return lead, p
        r = lead & 127; sh = 7
        for _ in range(4):
            g = data[p]; p += 1; r |= (g & 127) << sh; sh += 7
            if g < 128: break
        return r, p
    def dec_index(p, last):
        v, p = vbyte(p); return (last + ((v >> 1) ^ -(v & 1))) & 0xFFFFFFFF, p
    i = 0
    while i < index_count:
        ct = data[code]; code += 1
        if ct < 0xF0:
            fe = ct >> 4; a, b = ef[(efo - 1 - fe) & 15]; fec = ct & 15
            if fec < fecmax:
                cf = vf[(vfo - 1 - fec) & 15]; c = nxt if fec == 0 else cf; f0 = 1 if fec == 0 else 0; nxt += f0
                out[i] = a; out[i + 1] = b; out[i + 2] = c
                vf[vfo] = c; vfo = (vfo + f0) & 15
                ef[efo] = [c, b]; efo = (efo + 1) & 15; ef[efo] = [a, c]; efo = (efo + 1) & 15
            else:
                if fec != 15: c = (last + (fec - (fec ^ 3))) & 0xFFFFFFFF
                else: c, dp = dec_index(dp, last)
                last = c
                out[i] = a; out[i + 1] = b; out[i + 2] = c
                vf[vfo] = c; vfo = (vfo + 1) & 15
                ef[efo] = [c, b]; efo = (efo + 1) & 15; ef[efo] = [a, c]; efo = (efo + 1) & 15
        else:
            if ct < 0xFE:
                ca = aux[ct & 15]; feb = ca >> 4; fec = ca & 15
                a = nxt; nxt += 1
                bf = vf[(vfo - feb) & 15]; b = nxt if feb == 0 else bf; fb0 = 1 if feb == 0 else 0; nxt += fb0
                cf = vf[(vfo - fec) & 15]; c = nxt if fec == 0 else cf; fc0 = 1 if fec == 0 else 0; nxt += fc0
                out[i] = a; out[i + 1] = b; out[i + 2] = c
                vf[vfo] = a; vfo = (vfo + 1) & 15
                vf[vfo] = b; vfo = (vfo + fb0) & 15
                vf[vfo] = c; vfo = (vfo + fc0) & 15
                ef[efo] = [b, a]; efo = (efo + 1) & 15; ef[efo] = [c, b]; efo = (efo + 1) & 15; ef[efo] = [a, c]; efo = (efo + 1) & 15
            else:
                ca = data[dp]; dp += 1
                fea = 0 if ct == 0xFE else 15; feb = ca >> 4; fec = ca & 15
                if ca == 0: nxt = 0
                if fea == 0: a = nxt; nxt += 1
                else: a = 0
                if feb == 0: b = nxt; nxt += 1
                else: b = vf[(vfo - feb) & 15]
                if fec == 0: c = nxt; nxt += 1
                else: c = vf[(vfo - fec) & 15]
                if fea == 15: a, dp = dec_index(dp, last); last = a
                if feb == 15: b, dp = dec_index(dp, last); last = b
                if fec == 15: c, dp = dec_index(dp, last); last = c
                out[i] = a; out[i + 1] = b; out[i + 2] = c
                vf[vfo] = a; vfo = (vfo + 1) & 15
                vf[vfo] = b; vfo = (vfo + (1 if feb in (0, 15) else 0)) & 15
                vf[vfo] = c; vfo = (vfo + (1 if fec in (0, 15) else 0)) & 15
                ef[efo] = [b, a]; efo = (efo + 1) & 15; ef[efo] = [c, b]; efo = (efo + 1) & 15; ef[efo] = [a, c]; efo = (efo + 1) & 15
        i += 3
    assert dp == safe_end, 'decodificação de índices inconsistente (%d != %d)' % (dp, safe_end)
    return out

# ---------------- acessores ----------------
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def view_bytes(js, binc, vi, cache):
    if vi in cache: return cache[vi]
    v = js['bufferViews'][vi]; ext = v.get('extensions', {}).get('EXT_meshopt_compression')
    if ext:
        src = binc[ext['byteOffset']:ext['byteOffset'] + ext['byteLength']]
        if ext['mode'] == 'ATTRIBUTES':
            raw = decode_vertex_buffer(src, ext['count'], ext['byteStride'])
            if ext.get('filter') == 'EXPONENTIAL': res = ('f', filter_exp(raw.reshape(-1).copy(), ext['byteStride']))
            elif ext.get('filter') in (None, 'NONE'): res = ('raw', raw)
            else: raise ValueError('filtro não suportado: ' + ext.get('filter'))
        elif ext['mode'] == 'TRIANGLES': res = ('idx', decode_index_buffer(src, ext['count']))
        else: raise ValueError('modo não suportado: ' + ext['mode'])
    else:
        res = ('plain', binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])
    cache[vi] = res; return res

def accessor(js, binc, ai, cache):
    a = js['accessors'][ai]; kind, data = view_bytes(js, binc, a['bufferView'], cache); n = NC[a['type']]
    if kind == 'f': return data[:, :n].astype(np.float32)
    if kind == 'idx': return data.astype(np.uint32)
    if kind == 'raw':
        dt = CT[a['componentType']]; arr = data.view(dt)[:, :n].astype(np.float32)
    else:
        dt = CT[a['componentType']]; arr = np.frombuffer(data, dtype=dt).reshape(-1, n).astype(np.float32) if n > 1 else np.frombuffer(data, dtype=dt).astype(np.float32)
    if a.get('normalized'):
        arr = np.maximum(arr / {np.int8: 127.0, np.uint8: 255.0, np.int16: 32767.0, np.uint16: 65535.0}[CT[a['componentType']]], -1.0)
    return arr

# ---------------- simplificação por agrupamento de vértices ----------------
def simplify(P, N, UV, I, grid, uvgrid):
    mn, mx = P.min(0), P.max(0); ext = (mx - mn).max()
    q = np.floor((P - mn) / ext * grid).astype(np.int64)
    quv = np.floor(np.mod(UV, 1.0) * uvgrid).astype(np.int64)
    key = ((q[:, 0] * (grid + 1) + q[:, 1]) * (grid + 1) + q[:, 2]) * (uvgrid * uvgrid) + quv[:, 0] * uvgrid + quv[:, 1]
    uniq, cid = np.unique(key, return_inverse=True)
    k = len(uniq); cnt = np.bincount(cid, minlength=k).astype(np.float32)[:, None]
    # posição: média por célula de POSIÇÃO (igual para todos os pedaços de UV daquela célula) — evita frestas nas emendas
    pkey = (q[:, 0] * (grid + 1) + q[:, 1]) * (grid + 1) + q[:, 2]; pu, pid = np.unique(pkey, return_inverse=True)
    PP = np.zeros((len(pu), 3), np.float64); np.add.at(PP, pid, P); PP /= np.bincount(pid).astype(np.float64)[:, None]
    P2 = np.zeros((k, 3), np.float64); P2[cid] = PP[pid]
    N2 = np.zeros((k, 3), np.float64); np.add.at(N2, cid, N); N2 /= np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-6)
    U2 = np.zeros((k, 2), np.float64); np.add.at(U2, cid, UV); U2 /= cnt
    T = cid[I.reshape(-1, 3)]
    ok = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2]); T = T[ok]
    _, first = np.unique(np.sort(T, axis=1), axis=0, return_index=True); T = T[np.sort(first)]
    used = np.unique(T); remap = -np.ones(k, np.int64); remap[used] = np.arange(len(used))
    return P2[used].astype(np.float32), N2[used].astype(np.float32), U2[used].astype(np.float32), remap[T].astype(np.uint32)

def target_simplify(P, N, UV, I, max_tris, max_verts=65000):
    grid = 160
    while True:
        p, n, u, t = simplify(P, N, UV, I, grid, 24)
        if len(t) <= max_tris and len(p) <= max_verts: return p, n, u, t, grid
        grid = int(grid * 0.82)

# ---------------- exportação ----------------
def pack(p, n, u, t):
    mn, mx = p.min(0), p.max(0); sc = np.maximum(mx - mn, 1e-6)
    qp = np.round((p - mn) / sc * 65535).astype(np.uint16)
    qn = np.round(np.clip(n, -1, 1) * 127).astype(np.int8)
    qu = np.round(np.clip(u, 0, 1) * 65535).astype(np.uint16)
    return {'min': [float(v) for v in mn], 'scale': [float(v) for v in sc], 'verts': len(p), 'tris': len(t)}, qp.tobytes() + np.concatenate([qn, np.zeros((len(qn), 1), np.int8)], 1).tobytes() + qu.tobytes() + t.astype(np.uint16).tobytes()

def process(path, outdir, name):
    js, binc = read_glb(path); cache = {}
    prim = js['meshes'][0]['primitives'][0]; at = prim['attributes']
    P = accessor(js, binc, at['POSITION'], cache); N = accessor(js, binc, at['NORMAL'], cache); UV = accessor(js, binc, at['TEXCOORD_0'], cache); I = accessor(js, binc, prim['indices'], cache)
    assert I.max() < len(P), 'índices fora do limite'
    lods = []; blobs = b''
    for max_tris in (14000, 5200, 2200):   # perto, médio e longe
        p, n, u, t, grid = target_simplify(P, N, UV, I, max_tris)
        hdr, blob = pack(p, n, u, t); hdr['offset'] = len(blobs); hdr['grid'] = grid; lods.append(hdr); blobs += blob
        while len(blobs) % 4: blobs += b'\x00'
    mn, mx = P.min(0), P.max(0)
    meta = {'name': name, 'source': os.path.basename(path), 'srcTris': int(len(I) // 3), 'bbox': [[float(v) for v in mn], [float(v) for v in mx]], 'lods': lods}
    js_meta = json.dumps(meta).encode(); pad = (4 - (len(js_meta) + 4) % 4) % 4; js_meta += b' ' * pad
    open(os.path.join(outdir, name + '.bin'), 'wb').write(struct.pack('<I', len(js_meta)) + js_meta + blobs)
    # textura de cor (a primeira) reduzida
    tex = js['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']; img = js['images'][js['textures'][tex]['source']]
    bv = js['bufferViews'][img['bufferView']]; im = Image.open(io.BytesIO(binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')
    im = im.resize((1024, 1024), Image.LANCZOS)
    # preenche o fundo da textura (fora das "ilhas" de UV) com a cor da ilha mais próxima: a malha simplificada
    # às vezes amostra um pouco fora da ilha e mostraria riscos claros nas emendas
    from scipy import ndimage
    R = 1024; u = np.clip((np.mod(UV[:, 0], 1.0) * R).astype(int), 0, R - 1); v = np.clip((np.mod(UV[:, 1], 1.0) * R).astype(int), 0, R - 1)
    mask = np.zeros((R, R), bool); mask[v, u] = True
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3)), iterations=3); mask = ndimage.binary_fill_holes(mask); mask = ndimage.binary_erosion(mask, iterations=1)
    arr = np.asarray(im).copy(); _, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True); arr = arr[iy, ix]
    Image.fromarray(arr).save(os.path.join(outdir, name + '.jpg'), quality=84, optimize=True, progressive=False)
    return meta

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    names = sys.argv[3:] or sorted(f[:-4] for f in os.listdir(src) if f.endswith('.glb'))
    for nm in names:
        m = process(os.path.join(src, nm + '.glb'), out, nm)
        print(nm, 'original', m['srcTris'], 'triângulos ->', [l['tris'] for l in m['lods']], 'bbox', [[round(v, 3) for v in b] for b in m['bbox']])
