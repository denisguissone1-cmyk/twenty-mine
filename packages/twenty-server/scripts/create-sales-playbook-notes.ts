// One-time setup script: creates a set of sales playbook Notes (funnel
// stages, follow-up cadence, call script, operating rhythm) in a running
// Twenty workspace, synthesized from the user's own sales/business
// knowledge base (long-cycle, high-ticket B2B/services model).
//   TWENTY_API_KEY=<key> npx tsx packages/twenty-server/scripts/create-sales-playbook-notes.ts
// Idempotent: skips any note whose title already exists.

export {};

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_KEY) {
  console.error('Missing TWENTY_API_KEY environment variable.');
  console.error(
    'Generate one in the Twenty UI: Settings -> APIs & Webhooks -> create a key.',
  );
  process.exit(1);
}

const request = async (
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }

  return response.json();
};

type Note = { id: string; title: string };

const unwrapList = (json: unknown, legacyKey: string): Note[] => {
  const data = (json as { data?: unknown })?.data;

  if (Array.isArray(data)) {
    return data as Note[];
  }

  const legacyList = (data as Record<string, unknown> | undefined)?.[
    legacyKey
  ];

  return Array.isArray(legacyList) ? (legacyList as Note[]) : [];
};

const findNoteByTitle = async (title: string): Promise<Note | undefined> => {
  const filter = `title[eq]:'${encodeURIComponent(title)}'`;
  const json = await request('GET', `/rest/notes?filter=${filter}&limit=1`);

  return unwrapList(json, 'notes')[0];
};

const createNoteIfMissing = async (
  title: string,
  markdown: string,
): Promise<void> => {
  const existing = await findNoteByTitle(title);

  if (existing) {
    console.log(`  skipped (already exists): "${title}"`);

    return;
  }

  await request('POST', '/rest/notes', {
    title,
    bodyV2: { markdown, blocknote: null },
  });
  console.log(`  created: "${title}"`);
};

const PLAYBOOK_NOTES: { title: string; markdown: string }[] = [
  {
    title: 'Playbook — Cadência de Follow-up (Ciclo Longo / High-Ticket)',
    markdown: `# Cadência de Follow-up — Ciclo Longo / High-Ticket

Princípio central: todo serviço de alto valor é um fluxo de venda longo — o cliente precisa de tempo pra considerar e comparar opções. O vendedor não fica esperando passivamente a resposta; ele acompanha ativamente do primeiro contato até o pós-proposta.

## SLA de resposta
- Responder todo lead em **até 5 minutos**. Quem chama agora, decide agora.

## Régua de follow-up (lead ainda não teve reunião)
- **D0**: primeiro contato
- **D+1**: segundo toque se não respondeu (reforço + pergunta aberta)
- **D+3**: terceiro toque (novo ângulo ou conteúdo de valor)
- **D+7**: toque de reengajamento
- **D+14**: último toque antes de mover para "frio" / descarte

## Régua pós-reunião / pós-proposta (D1-D2-D3)
Quando a venda não fecha na reunião, seguir com método — nunca "só esperando o Pix":
- **D1 — Convite**: reforça o próximo passo combinado na reunião
- **D2 — Objeção**: pergunta diretamente o que está travando a decisão
- **D3 — Fechamento**: pede uma decisão objetiva (sim ou não), com clareza

## Regra de ouro
Todo lead que não respondeu passa pela cadeia de follow-up até fechar ou ser descartado — nunca fica esperando passivamente.`,
  },
  {
    title: 'Playbook — Roteiro de Atendimento e Diagnóstico',
    markdown: `# Roteiro de Atendimento e Diagnóstico

## Estrutura da reunião/atendimento (4 fases)
1. **Abertura**
2. **Qualificação / Diagnóstico**
3. **Proposta**
4. **Próximo passo** (sempre definir antes de encerrar)

## Técnica de diagnóstico: "ferida nas costas"
A habilidade do vendedor está mais ligada a **gerar um problema** do que a gerar uma solução. Não espere o cliente trazer o problema — muitas vezes ele tem uma dor real mas não percebe ("ferida nas costas: dói, mas ele não sente porque não vê").

Como encontrar:
- **Análise explícita**: olhar o que já é público (site, redes sociais, posicionamento digital, funil de vendas do cliente) e apontar o que está fraco.
- **Perguntas técnicas de diagnóstico**: perguntas que revelam falta de controle/clareza no negócio do cliente (ex.: "como está seu ponto de equilíbrio?", "como está sua DRE?"). Quando o cliente não sabe responder, isso evidencia o problema por si só.

## Regra de ouro
**Primeiro prova, depois proposta.** Não negocie preço antes de negociar confiança — construa autoridade e prova de valor antes de qualquer proposta comercial.

Se a reunião não fechar, segue para a cadência de follow-up (ver nota "Cadência de Follow-up").`,
  },
  {
    title: 'Playbook — Rotina Operacional e Métricas',
    markdown: `# Rotina Operacional e Métricas

## Rotina diária de CRM
- **30 minutos** no início do dia: revisar leads, priorizar follow-ups do dia.
- **60 minutos** no final do dia: atualizar etapas, registrar próximos passos, mover cards.
- Reunião rápida diária com o time (10 min): prioridades, travas, foco.

## O que uma operação comercial madura acompanha (não só "vendeu ou não")
- Quantos leads chamaram/entraram
- Quantos orçamentos/propostas estão na mesa
- Quantos estão aguardando retorno
- Quantos aprovaram e estão só esperando o pagamento cair

Vendas é reflexo dessas métricas intermediárias — olhar só o resultado final ("vendeu, não vendeu") é operar no escuro.

## Regra de ouro
CRM é o coração da operação comercial — nunca deixar o relacionamento com o cliente centralizado no WhatsApp pessoal de uma única pessoa (isso trava a empresa quando essa pessoa some/tira férias). A operação comercial precisa rodar independente de qualquer pessoa específica.`,
  },
];

const main = async () => {
  console.log(`Using Twenty API at ${API_URL}`);
  console.log('\nCreating sales playbook notes...');

  for (const note of PLAYBOOK_NOTES) {
    await createNoteIfMissing(note.title, note.markdown);
  }

  console.log('\nDone.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
