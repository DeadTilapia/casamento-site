// --- Conexão com o Supabase (compartilhada entre as páginas do site) ---
const SUPABASE_URL = 'https://eosxiwmkwbvfjhebhxud.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Toy-wRW1IXRtA-BNKa4dkg_dWzoT1XV';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Copia texto pra área de transferência, com fallback pra navegadores/contextos
// sem Clipboard API. Retorna true/false conforme conseguiu copiar ou não.
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    document.body.removeChild(textarea);
    return ok;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- Mensagens de erro amigáveis ---
// Traduz o código técnico que o Supabase/Postgres devolve pra uma frase que
// explica o que aconteceu de verdade, em vez de um "algo deu errado" genérico.
// O código original fica entre parênteses no final, só pra facilitar suporte
// caso o erro se repita e precise ser reportado.
const MENSAGENS_ERRO_PADRAO = {
  '23503': 'Esse registro está vinculado a outro (por exemplo, uma resposta já registrada) e por isso não pode ser removido ou alterado assim.',
  '23505': 'Já existe um registro igual a esse — parece estar duplicado.',
  '23502': 'Faltou preencher um campo obrigatório.',
  '22P02': 'Um dos valores digitados não é válido.',
  '42501': 'Sem permissão pra fazer isso. Confira se ainda está logado.',
  'PGRST301': 'Sua sessão expirou. Faça login de novo.',
  'PGRST116': 'Esse registro não foi encontrado — pode já ter sido alterado ou removido em outra aba.',
};

// Mensagens específicas por ação, usadas quando a genérica acima não é clara
// o suficiente pro contexto (ex: "está vinculado a outro" fica mais claro
// falando exatamente do que se trata em cada tela).
const MENSAGENS_ERRO_CONTEXTO = {
  remover_convidado: {
    '23503': 'Essa pessoa já tem respostas registradas (RSVP ou presente escolhido) vinculadas a ela, então não dá pra remover assim. Desvincule as respostas dela primeiro, se ainda quiser remover.',
  },
};

function mensagemErro(error, contexto) {
  if (!error) return 'Algo deu errado. Tente novamente em instantes.';

  const codigo = error.code || '';
  const mensagemOriginal = String(error.message || '').toLowerCase();

  if (!codigo && (mensagemOriginal.includes('fetch') || mensagemOriginal.includes('network'))) {
    return 'Não foi possível conectar. Verifique sua internet e tente de novo.';
  }

  const especifica = contexto && MENSAGENS_ERRO_CONTEXTO[contexto] && MENSAGENS_ERRO_CONTEXTO[contexto][codigo];
  const texto = especifica || MENSAGENS_ERRO_PADRAO[codigo] || 'Algo deu errado ao salvar. Tente novamente em instantes.';
  return codigo ? `${texto} (código ${codigo})` : texto;
}

// --- Dados do Pix (tela de pagamento do RSVP, em index.html) ---
const PIX_CHAVE = '74311276-7c26-4d7a-9cf1-d4410f2a4ccb';
const PIX_NOME = 'ALEXANDRE ERCOLIN';
const PIX_CIDADE = 'PIRACICABA';

// Gera o "Pix Copia e Cola" (BR Code / EMV QR Code) no formato do Banco Central.
// Referência: Manual do BR Code (bcb.gov.br).
function gerarPayloadPix({ chave, nome, cidade, valor, descricao, txid }) {
  // O padrão pede texto simples (ASCII) nos campos — remove acentos pra
  // evitar que algum app de banco mais rígido rejeite ou mostre errado.
  function semAcento(texto) {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }

  function tlv(id, value) {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  }

  function crc16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  const contaPix =
    tlv('00', 'BR.GOV.BCB.PIX') +
    tlv('01', chave) +
    (descricao ? tlv('02', semAcento(descricao).slice(0, 40)) : '');

  const dadosAdicionais = tlv('05', semAcento(txid || '***').slice(0, 25));

  let payload =
    tlv('00', '01') +
    tlv('01', '11') +
    tlv('26', contaPix) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (valor ? tlv('54', Number(valor).toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', semAcento(nome).toUpperCase().slice(0, 25)) +
    tlv('60', semAcento(cidade).toUpperCase().slice(0, 15)) +
    tlv('62', dadosAdicionais);

  payload += '6304';
  return payload + crc16(payload);
}
