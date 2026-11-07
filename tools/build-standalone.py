# Gera dist/complexo-do-escadao-3d.html: um arquivo único que roda o jogo sem servidor (treino com bots).
# As salas online exigem o servidor (npm start / Render).
import base64, os, re
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
b64 = lambda p: 'data:audio/mpeg;base64,' + base64.b64encode(open(os.path.join(R, p), 'rb').read()).decode()
html = rd('public/index.html')
html = html.replace('<link rel="stylesheet" href="/css/style.css">', '<style>\n' + rd('public/css/style.css') + '\n</style>')
html = html.replace('<script src="/socket.io/socket.io.js" onerror="void 0"></script>\n', '')
html = html.replace('<script src="/shared/sim.js"></script>', '<script>window.ESC_AUDIO={rifle:"%s",pistol:"%s",amb:__AMB__,baile:__BAILE__};</script>\n<script>\n%s\n</script>' % (b64('public/audio/fuzil.mp3'), b64('public/audio/pistola.mp3'), rd('shared/sim.js')))
models = '{' + ','.join('%s:{bin:"data:application/octet-stream;base64,%s",jpg:"data:image/jpeg;base64,%s"}' % (n, base64.b64encode(open(os.path.join(R, 'public/models', n + '.bin'), 'rb').read()).decode(), base64.b64encode(open(os.path.join(R, 'public/models', n + '.jpg'), 'rb').read()).decode()) for n in ['casa1', 'comercio', 'skj', 'ssjj', 'xx', 'zss']) + '}'
html = html.replace('__BAILE__', '"%s"' % b64('public/audio/baile.mp3'))
html = html.replace('__AMB__', '[' + ','.join('"%s"' % b64('public/audio/ambiente/tiroteio_%d.mp3' % k) for k in (1, 2, 3, 4)) + ']')
html = html.replace('<script>window.ESC_AUDIO=', '<script>window.ESC_MODELS=' + models + ';window.ESC_AUDIO=')
for f in ['render', 'audio', 'hud', 'models', 'voice', 'play', 'app']:
    html = html.replace('<script src="/js/%s.js"></script>' % f, '<script>\n' + rd('public/js/%s.js' % f) + '\n</script>')
assert '/js/' not in html.split('<script>')[0]
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
open(os.path.join(R, 'dist', 'complexo-do-escadao-3d.html'), 'w', encoding='utf-8').write(html)
print('ok', len(html))
