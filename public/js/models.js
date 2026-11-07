/* Complexo do Escadão 3D — construções modeladas (arquivos .bin + .jpg gerados por tools/process_models.py).
   Cada modelo tem duas versões (perto e longe) e é desenhado várias vezes pelo mapa. */
(function () {
'use strict';
const S = window.EscSim, RND = window.EscRender;
function create(R, sources, map) {
  const gl = R.gl, types = {}, ready = { n: 0 };
  const compile = (vs, fs) => { const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    const a = {}; for (const nm of ['aP', 'aN', 'aU']) a[nm] = gl.getAttribLocation(p, nm); return { p, u, a }; };
  const prog = compile(`precision highp float; attribute vec3 aP; attribute vec3 aN; attribute vec2 aU; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uMin; uniform vec3 uScale; uniform vec3 uEye;
    varying vec3 vN; varying vec2 vU; varying float vD; varying float vH;
    void main(){ vec3 p = uMin + aP * uScale; vec4 w = uM * vec4(p, 1.0); vN = mat3(uM) * aN; vU = aU; vD = distance(w.xyz, uEye); vH = aP.y; gl_Position = uVP * w; }`,
    `#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform sampler2D uTex; uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uAmbC; uniform vec3 uLampC; uniform float uLamp; uniform float uFogD; uniform vec3 uFogC;
    varying vec3 vN; varying vec2 vU; varying float vD; varying float vH;
    void main(){ vec3 n = normalize(vN); float d = max(dot(n, uSun), 0.0); vec3 tx = texture2D(uTex, vU).rgb; float ao = 0.72 + 0.28 * clamp(vH * 3.0, 0.0, 1.0);
      vec3 c = tx * (uAmbC * ao + uSunC * d * 0.95 + uLampC * uLamp) * 1.32; float f = 1.0 - exp(-(vD * uFogD) * (vD * uFogD)); gl_FragColor = vec4(mix(c, uFogC, f), 1.0); }`);
  const SUN = RND.SUN;
  const defs = {}; for (const d of S.MODEL_DEFS) defs[d.name] = d;
  // luz dos postes perto de cada construção (pré-calculada)
  const lampAt = (x, y, z) => { let s = 0; for (const l of map.lights || []) { const d = Math.hypot(l.x - x, l.y - y, l.z - z); if (d < l.r) s += Math.pow(1 - d / l.r, 2) * l.i * 0.6; } return Math.min(1.2, s); };
  const inst = (map.models || []).map(m => { const D = defs[m.name], ang = m.rot * Math.PI / 2, X = RND.m4;
    // centraliza no lote, gira para a rua, escala para metros e apoia a base no chão
    const M = X.mul(X.mul(X.mul(X.tr(m.x, m.y - D.y0 * D.s, m.z), X.ry(ang)), X.sc(D.s, D.s, D.s)), X.tr(-D.cx, 0, -D.cz));
    return { name: m.name, M, x: m.x, z: m.z, y: m.y, r: Math.hypot(D.w, D.d) / 2 + 1, h: D.h, lamp: lampAt(m.x, m.y + 3, m.z) }; });
  async function loadOne(name, src) {
    const buf = await (await fetch(src.bin)).arrayBuffer(), dv = new DataView(buf), n = dv.getUint32(0, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))), base = 4 + n;
    const lods = meta.lods.map(L => { const o = base + L.offset, v = L.verts, t = L.tris;
      const mk = (arr, target) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, arr, gl.STATIC_DRAW); return b; };
      return { min: L.min, scale: L.scale, n: t * 3, pos: mk(new Uint16Array(buf, o, v * 3), gl.ARRAY_BUFFER), nrm: mk(new Int8Array(buf, o + v * 6, v * 4), gl.ARRAY_BUFFER), uv: mk(new Uint16Array(buf, o + v * 10, v * 2), gl.ARRAY_BUFFER), idx: mk(new Uint16Array(buf, o + v * 14, t * 3), gl.ELEMENT_ARRAY_BUFFER) }; });
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src.jpg; });
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 4); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    types[name] = { lods, tex, meta }; ready.n++;
  }
  const loading = Promise.all(Object.keys(sources).map(k => loadOne(k, sources[k]).catch(e => console.warn('modelo não carregou:', k, e))));
  function draw(quality) {
    const cur = R.cur, env = R.env, P = prog; if (!ready.n || !cur.VP) return 0;
    gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, cur.VP); gl.uniform3fv(P.u.uEye, cur.eye); gl.uniform3fv(P.u.uSun, SUN); gl.uniform3fv(P.u.uSunC, env.sunC); gl.uniform3fv(P.u.uAmbC, env.ambC); gl.uniform3fv(P.u.uLampC, env.lampC.map(v => v * env.lampOn)); gl.uniform1f(P.u.uFogD, cur.fogD); gl.uniform3fv(P.u.uFogC, env.fogC);
    for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(P.u.uTex, 0); let drawn = 0; const e = cur.eye, near = quality === 'baixo' ? 35 : quality === 'alto' ? 75 : 55;
    const fw = [cur.VP[2], cur.VP[6], cur.VP[10]]; // não usado: o descarte é feito por distância e pelo "atrás da câmera" abaixo
    for (const I of inst) { const T = types[I.name]; if (!T) continue; const d = Math.hypot(I.x - e[0], I.z - e[2]); if (d - I.r > cur.maxDist) continue;
      const cx = cur.VP[0] * I.x + cur.VP[4] * (I.y + I.h / 2) + cur.VP[8] * I.z + cur.VP[12], cw = cur.VP[3] * I.x + cur.VP[7] * (I.y + I.h / 2) + cur.VP[11] * I.z + cur.VP[15];
      if (cw < -I.r || Math.abs(cx) > cw + I.r * 2.5) continue; // fora do campo de visão
      const L = T.lods[d < near ? 0 : d < near * 2.4 || T.lods.length < 3 ? 1 : 2];
      gl.bindTexture(gl.TEXTURE_2D, T.tex); gl.uniformMatrix4fv(P.u.uM, false, I.M); gl.uniform3fv(P.u.uMin, L.min); gl.uniform3fv(P.u.uScale, L.scale); gl.uniform1f(P.u.uLamp, I.lamp);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.pos); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 3, gl.UNSIGNED_SHORT, true, 6, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.nrm); gl.enableVertexAttribArray(P.a.aN); gl.vertexAttribPointer(P.a.aN, 3, gl.BYTE, true, 4, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.uv); gl.enableVertexAttribArray(P.a.aU); gl.vertexAttribPointer(P.a.aU, 2, gl.UNSIGNED_SHORT, true, 4, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.idx); gl.drawElements(gl.TRIANGLES, L.n, gl.UNSIGNED_SHORT, 0); drawn++; }
    for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    return drawn;
  }
  return { draw, loading, types, inst, get loaded() { return ready.n; } };
}
window.EscModels = { create, list: ['casa1', 'comercio', 'skj', 'ssjj', 'xx', 'zss'] };
})();
