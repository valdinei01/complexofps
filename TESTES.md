# Revisão 2.0.2

Correções realizadas: spawn em área aberta central; orientação inicial para o centro; joystick com captura de ponteiro; disparo no primeiro clique de captura; limpeza de entradas ao perder foco; tratamento de erro ao iniciar o renderizador; redução do risco de bots atravessarem construções (movimentação limitada à área central).

Verificações locais: sintaxe JavaScript (Node.js --check), inspeção do código de colisão e dos pontos de spawn, integridade do ZIP.

Limitação: não foi possível instalar dependências neste ambiente para executar o servidor completo, nem realizar teste visual de navegador ou multiplayer. Testar no Render antes de considerar a versão estável.

Teste manual recomendado: criar sala sem senha; criar sala com senha; entrar com segundo dispositivo; adicionar bots; iniciar; andar com WASD e joystick; girar câmera; disparar; trocar arma; morrer e reaparecer; reconectar após queda de rede.
