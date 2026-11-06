// mini executor de testes (sem dependências)
let pass = 0, fail = 0; const fails = [];
function test(name, fn) { try { fn(); pass++; console.log('  ✔ ' + name); } catch (e) { fail++; fails.push(name); console.log('  ✘ ' + name + '\n      → ' + (e && e.message)); } }
function eq(a, b, msg) { if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + JSON.stringify(b) + ', obtido ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'falhou'); }
async function testAsync(name, fn) { try { await fn(); pass++; console.log('  ✔ ' + name); } catch (e) { fail++; fails.push(name); console.log('  ✘ ' + name + '\n      → ' + (e && e.message)); } }
function summary() { console.log(`\n${pass} passaram, ${fail} falharam`); if (fail) { process.exitCode = 1; } }
module.exports = { test, testAsync, eq, ok, summary };
