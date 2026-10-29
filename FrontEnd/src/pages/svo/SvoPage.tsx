import React, { useMemo, useState } from "react";
import {
  Activity, Ambulance, ArrowUpRight, Check, CheckCircle2,
  ChevronRight, Clock3, MapPin, Phone, Plus, Search, ShieldAlert, Siren,
  Users, X,
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select, Textarea } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { cn } from "../../lib/utils";

type StatusChamado = "AGUARDANDO_TRIAGEM" | "EM_TRIAGEM" | "TRIAGEM_APROVADA" | "ORDEM_GERADA" | "ENCERRADO";
type ModalSvo = "REGISTRO" | "TRIAGEM" | "ORDEM" | "DETALHE" | null;
type Chamado = {
  id: string; protocolo: string; recebido: string; solicitante: string; telefone: string;
  municipio: string; endereco: string; relato: string; urgencia: "Prioritário" | "Rotina";
  status: StatusChamado; justificativaTriagem?: string; ordemId?: string;
};
type StatusViatura = "Disponível" | "Em coleta" | "Em desinfecção";
type Viatura = { id: string; nome: string; placa: string; motorista: string; ocupacao: number; status: StatusViatura; local: string };

const CHAMADOS_INICIAIS: Chamado[] = [
  { id: "1", protocolo: "SVO-2026-00842", recebido: "14:32", solicitante: "Mariana Costa", telefone: "(79) 9 8123-4567", municipio: "Aracaju · Atalaia", endereco: "Rua das Acácias, 184", relato: "Óbito domiciliar informado pela família. Sem relato de violência.", urgencia: "Prioritário", status: "AGUARDANDO_TRIAGEM" },
  { id: "2", protocolo: "SVO-2026-00841", recebido: "14:18", solicitante: "Carlos Nascimento", telefone: "(79) 9 8765-4321", municipio: "Nossa Senhora do Socorro", endereco: "Conj. Jardim, bloco 4", relato: "Solicitação recebida por telefone para avaliação do SVO.", urgencia: "Rotina", status: "EM_TRIAGEM" },
  { id: "3", protocolo: "SVO-2026-00840", recebido: "13:56", solicitante: "Ana Paula Santos", telefone: "(79) 9 9345-6781", municipio: "São Cristóvão · Centro", endereco: "Rua 24, 52", relato: "Óbito em residência, histórico clínico relatado pelo solicitante.", urgencia: "Rotina", status: "ORDEM_GERADA" },
  { id: "4", protocolo: "SVO-2026-00839", recebido: "13:21", solicitante: "João Oliveira", telefone: "(79) 9 9234-5678", municipio: "Aracaju · Industrial", endereco: "Av. Maranhão, 910", relato: "Família orientada e chamado registrado para avaliação.", urgencia: "Rotina", status: "ENCERRADO" },
];
const VIATURAS_INICIAIS: Viatura[] = [
  { id: "v1", nome: "Unidade SVO 01", placa: "QMA-4J28", motorista: "Roberto Lima", ocupacao: 2, status: "Em coleta", local: "Bairro Atalaia, Aracaju" },
  { id: "v2", nome: "Unidade SVO 02", placa: "QKT-8A15", motorista: "Marcos Andrade", ocupacao: 0, status: "Disponível", local: "Base SVO · Aracaju" },
  { id: "v3", nome: "Unidade SVO 03", placa: "QMD-2C71", motorista: "Paulo Santos", ocupacao: 0, status: "Em desinfecção", local: "Base SVO · Aracaju" },
];

const STATUS_LABEL: Record<StatusChamado, string> = {
  AGUARDANDO_TRIAGEM: "Aguardando triagem", EM_TRIAGEM: "Em triagem",
  TRIAGEM_APROVADA: "Triagem aprovada", ORDEM_GERADA: "Ordem de coleta", ENCERRADO: "Encerrado",
};
const STATUS_VARIANT: Record<StatusChamado, "warning" | "info" | "success" | "neutral"> = {
  AGUARDANDO_TRIAGEM: "warning", EM_TRIAGEM: "info", ORDEM_GERADA: "success", ENCERRADO: "neutral",
  TRIAGEM_APROVADA: "success",
};
const FILTROS: { id: StatusChamado | "TODOS"; label: string }[] = [
  { id: "TODOS", label: "Todos" }, { id: "AGUARDANDO_TRIAGEM", label: "Aguardando" },
  { id: "EM_TRIAGEM", label: "Em triagem" }, { id: "ORDEM_GERADA", label: "Em operação" },
  { id: "ENCERRADO", label: "Encerrados" },
];

export const SvoPage: React.FC = () => {
  const { user } = useAuth();
  const [chamados, setChamados] = useState(CHAMADOS_INICIAIS);
  const [viaturas, setViaturas] = useState(VIATURAS_INICIAIS);
  const [filtro, setFiltro] = useState<StatusChamado | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Chamado | null>(null);
  const [modal, setModal] = useState<ModalSvo>(null);
  const [justificativa, setJustificativa] = useState("");
  const [aviso, setAviso] = useState("");
  const [novoChamado, setNovoChamado] = useState({ solicitante: "", telefone: "", municipio: "", endereco: "", relato: "", urgencia: "Rotina" as Chamado["urgencia"] });
  const [viaturaId, setViaturaId] = useState("");
  const [quantidadeObitos, setQuantidadeObitos] = useState("1");

  const contagem = useMemo(() => ({
    recebidos: chamados.length,
    aguardando: chamados.filter((c) => c.status === "AGUARDANDO_TRIAGEM").length,
    emOperacao: chamados.filter((c) => c.status === "ORDEM_GERADA").length,
    disponiveis: viaturas.filter((v) => v.status === "Disponível").length,
  }), [chamados, viaturas]);

  const filtrados = chamados.filter((c) => {
    const termo = busca.trim().toLowerCase();
    const correspondeAoFiltro = filtro === "TODOS" || c.status === filtro || (filtro === "ORDEM_GERADA" && c.status === "TRIAGEM_APROVADA") || (filtro === "ENCERRADO" && c.status === "ENCERRADO");
    return correspondeAoFiltro && (!termo ||
      [c.protocolo, c.solicitante, c.municipio].some((v) => v.toLowerCase().includes(termo)));
  });

  const atualizarStatus = (id: string, status: StatusChamado) => {
    setChamados((atual) => atual.map((c) => c.id === id ? { ...c, status } : c));
    setSelecionado((atual) => atual?.id === id ? { ...atual, status } : atual);
  };

  const fecharModal = () => { setModal(null); setSelecionado(null); setJustificativa(""); };

  const abrirRegistro = () => {
    setNovoChamado({ solicitante: "", telefone: "", municipio: "", endereco: "", relato: "", urgencia: "Rotina" });
    setSelecionado(null);
    setModal("REGISTRO");
  };

  const registrarChamado = () => {
    if (Object.values(novoChamado).some((valor) => !String(valor).trim())) return;
    const agora = new Date();
    const protocolo = `SVO-${agora.getFullYear()}-${String(842 + chamados.length + 1).padStart(5, "0")}`;
    const novo: Chamado = {
      ...novoChamado,
      id: `svo-${Date.now()}`,
      protocolo,
      recebido: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(agora),
      status: "AGUARDANDO_TRIAGEM",
    };
    setChamados((atual) => [novo, ...atual]);
    setFiltro("TODOS"); setBusca(""); setAviso(`Chamado ${protocolo} registrado e incluído na fila de triagem.`); fecharModal();
  };

  const iniciarTriagem = (chamado: Chamado) => {
    const emTriagem = { ...chamado, status: "EM_TRIAGEM" as const };
    atualizarStatus(chamado.id, "EM_TRIAGEM");
    setSelecionado(emTriagem); setJustificativa(chamado.justificativaTriagem ?? ""); setModal("TRIAGEM");
  };

  const concluirTriagem = (aprovada: boolean) => {
    if (!selecionado || justificativa.trim().length < 8) return;
    const novoStatus = aprovada ? "TRIAGEM_APROVADA" : "ENCERRADO";
    setChamados((atual) => atual.map((c) => c.id === selecionado.id ? { ...c, status: novoStatus, justificativaTriagem: justificativa.trim() } : c));
    setAviso(aprovada ? `Triagem aprovada para ${selecionado.protocolo}. Emita a ordem de coleta para despachar a viatura.` : `Triagem de ${selecionado.protocolo} encerrada com justificativa registrada.`);
    fecharModal();
  };

  const abrirEmissaoOrdem = (chamado: Chamado) => {
    const primeiraElegivel = viaturas.find((v) => (v.status === "Disponível" || v.status === "Em coleta") && v.ocupacao < 4);
    setSelecionado(chamado); setViaturaId(primeiraElegivel?.id ?? ""); setQuantidadeObitos("1"); setModal("ORDEM");
  };

  const emitirOrdem = () => {
    if (!selecionado) return;
    const viatura = viaturas.find((v) => v.id === viaturaId);
    const quantidade = Number(quantidadeObitos);
    if (!viatura || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 4 - viatura.ocupacao || !["Disponível", "Em coleta"].includes(viatura.status)) {
      setAviso("Selecione uma viatura apta e respeite o limite de 4 óbitos por veículo."); return;
    }
    const ordemId = `OC-${new Date().getFullYear()}-${String(100 + chamados.length).padStart(4, "0")}`;
    setChamados((atual) => atual.map((c) => c.id === selecionado.id ? { ...c, status: "ORDEM_GERADA", ordemId } : c));
    setViaturas((atual) => atual.map((v) => v.id === viatura.id ? { ...v, status: "Em coleta", ocupacao: v.ocupacao + quantidade, local: selecionado.municipio } : v));
    setAviso(`Ordem ${ordemId} emitida para ${selecionado.protocolo} · ${viatura.nome} · ${quantidade} ${quantidade === 1 ? "óbito" : "óbitos"}.`);
    fecharModal();
  };

  const abrirDetalhes = (chamado: Chamado) => { setSelecionado(chamado); setModal("DETALHE"); };

  const concluirDesinfeccao = (viatura: Viatura) => {
    setViaturas((atual) => atual.map((v) => v.id === viatura.id ? { ...v, status: "Disponível", ocupacao: 0 } : v));
    setAviso(`${viatura.nome} liberada após confirmação da desinfecção.`);
  };

  const viaturasElegiveis = viaturas.filter((v) => (v.status === "Disponível" || v.status === "Em coleta") && v.ocupacao < 4);
  const viaturaDaOrdem = viaturas.find((v) => v.id === viaturaId);
  const vagasRestantes = viaturaDaOrdem ? 4 - viaturaDaOrdem.ocupacao : 0;
  const registroValido = Object.values(novoChamado).every((valor) => String(valor).trim().length > 0);
  const modalTitulo = modal === "REGISTRO" ? "Registrar chamado SVO" : modal === "TRIAGEM" ? "Triagem do chamado" : modal === "ORDEM" ? "Emitir ordem de coleta" : "Detalhes do chamado";
  const modalDescricao = modal === "REGISTRO" ? "Registre os dados recebidos por telefone para iniciar o atendimento." : modal === "TRIAGEM" ? "Avalie o relato e documente a decisão antes de emitir uma ordem." : modal === "ORDEM" ? "Defina a viatura e a quantidade a coletar respeitando a capacidade disponível." : "Resumo do atendimento e do andamento operacional.";

  const modalFooter = modal === "REGISTRO" ? <><Button variant="outline" onClick={fecharModal}>Cancelar</Button><Button onClick={registrarChamado} disabled={!registroValido}>Registrar chamado</Button></>
    : modal === "TRIAGEM" ? <><Button variant="outline" onClick={fecharModal}>Voltar</Button><Button variant="danger" onClick={() => concluirTriagem(false)} disabled={justificativa.trim().length < 8}>Encerrar triagem</Button><Button onClick={() => concluirTriagem(true)} disabled={justificativa.trim().length < 8}>Aprovar triagem</Button></>
      : modal === "ORDEM" ? <><Button variant="outline" onClick={fecharModal}>Cancelar</Button><Button onClick={emitirOrdem} disabled={!viaturaDaOrdem || Number(quantidadeObitos) < 1 || Number(quantidadeObitos) > vagasRestantes}>Emitir ordem de coleta</Button></>
        : <><Button variant="outline" onClick={fecharModal}>Fechar</Button>{selecionado?.status === "AGUARDANDO_TRIAGEM" && <Button onClick={() => selecionado && iniciarTriagem(selecionado)}>Iniciar triagem</Button>}{selecionado?.status === "EM_TRIAGEM" && <Button onClick={() => setModal("TRIAGEM")}>Continuar triagem</Button>}{selecionado?.status === "TRIAGEM_APROVADA" && <Button onClick={() => selecionado && abrirEmissaoOrdem(selecionado)}>Emitir ordem</Button>}</>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-rose-600"><span className="h-2 w-2 rounded-full bg-rose-500" /> Operação especializada</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Central de operações SVO</h1>
          <p className="mt-1 text-sm text-slate-500">Chamados, triagem e disponibilidade das viaturas em um só lugar.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-right sm:block"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Acesso</p><p className="text-xs font-bold text-slate-700">{user?.roles.includes("ADMIN") ? "Administrador" : "Atendente SVO"}</p></div>
          <div className="flex items-center gap-2"><Badge variant="success" dot>Plantão ativo</Badge><Button onClick={abrirRegistro} leftIcon={<Plus className="h-4 w-4" />}>Registrar chamado</Button></div>
        </div>
      </div>

      {aviso && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{aviso}</span><button type="button" aria-label="Fechar aviso" onClick={() => setAviso("")}><X className="h-4 w-4" /></button></div>}

      <section aria-label="Indicadores SVO" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={Phone} label="Chamados recebidos hoje" value={contagem.recebidos} trend="+12%" caption="vs. período anterior" tone="blue" />
        <Metric icon={Clock3} label="Aguardando triagem" value={contagem.aguardando} caption="Requer atenção" tone="amber" />
        <Metric icon={Activity} label="Coletas em andamento" value={contagem.emOperacao} caption="Ordens ativas" tone="rose" />
        <Metric icon={Ambulance} label="Viaturas disponíveis" value={`${contagem.disponiveis}/${viaturas.length}`} caption="Liberadas para despacho" tone="green" />
      </section>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2"><h2 className="text-base font-bold text-slate-900">Fila de chamados</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{filtrados.length}</span></div><p className="mt-1 text-xs text-slate-500">Acompanhe o atendimento e a triagem especializada.</p></div>
            <label className="relative w-full sm:max-w-[220px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Buscar chamado" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Protocolo ou município" className="pl-9" /></label>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3">{FILTROS.map((f) => <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className={cn("whitespace-nowrap border-b-2 px-3 pb-3 text-xs font-semibold transition-colors", filtro === f.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>{f.label}</button>)}</div>
          <div className="divide-y divide-slate-100">
            {filtrados.map((c) => <article key={c.id} className="p-4 transition-colors hover:bg-slate-50/70 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold tracking-wide text-slate-700">{c.protocolo}</span><Badge size="sm" variant={STATUS_VARIANT[c.status]} dot>{STATUS_LABEL[c.status]}</Badge>{c.urgencia === "Prioritário" && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-600"><Siren className="h-3 w-3" />Prioritário</span>}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Recebido às {c.recebido}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.municipio || "Local não informado"}</span></div>
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-800">{c.solicitante || "Novo atendimento telefônico"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.status === "AGUARDANDO_TRIAGEM" && <Button size="sm" onClick={() => iniciarTriagem(c)}>Iniciar triagem</Button>}
                  {c.status === "EM_TRIAGEM" && <Button size="sm" variant="outline" onClick={() => iniciarTriagem(c)}>Continuar <ChevronRight className="h-3.5 w-3.5" /></Button>}
                  {c.status === "TRIAGEM_APROVADA" && <Button size="sm" onClick={() => abrirEmissaoOrdem(c)}>Emitir ordem</Button>}
                  {c.status === "ORDEM_GERADA" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-4 w-4" />Despachado</span>}
                  <button type="button" onClick={() => abrirDetalhes(c)} aria-label={`Ver detalhes ${c.protocolo}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </article>)}
            {filtrados.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Nenhum chamado encontrado para este filtro.</div>}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>Atualização demonstrativa · agora</span><button type="button" onClick={() => { setBusca(""); setFiltro("TODOS"); }} className="font-semibold text-slate-700 hover:text-blue-700">Ver todos os chamados <ArrowUpRight className="inline h-3.5 w-3.5" /></button></div>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-base font-bold text-slate-900">Painel das viaturas</h2><p className="mt-1 text-xs text-slate-500">Capacidade operacional e status de cada unidade.</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Ambulance className="h-4.5 w-4.5" /></span></div>
          <div className="space-y-3 p-4">{viaturas.map((v) => {
            const disponivel = v.status === "Disponível";
            const desinfec = v.status === "Em desinfecção";
            return <div key={v.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-3"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", disponivel ? "bg-emerald-50 text-emerald-600" : desinfec ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600")}><Ambulance className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">{v.nome}</p><p className="font-mono text-[11px] text-slate-500">{v.placa}</p></div></div><Badge size="sm" dot variant={disponivel ? "success" : desinfec ? "warning" : "info"}>{v.status}</Badge></div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs"><span className="inline-flex items-center gap-1.5 text-slate-600"><Users className="h-3.5 w-3.5 text-slate-400" />{v.motorista}</span><span className="font-semibold text-slate-700">{v.ocupacao}/4 vagas</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", v.ocupacao >= 3 ? "bg-amber-500" : "bg-blue-500")} style={{ width: `${v.ocupacao * 25}%` }} /></div>
              <p className="mt-2 truncate text-[11px] text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />{v.local}</p>
              {desinfec && <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => concluirDesinfeccao(v)}>Confirmar desinfecção <CheckCircle2 className="h-3.5 w-3.5" /></Button>}
              {disponivel && <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Liberada para nova coleta</p>}
            </div>;
          })}</div>
          <div className="mx-4 mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Regra operacional:</strong> limite de 4 óbitos por viatura. Após cada entrega, a unidade fica bloqueada até a confirmação da desinfecção.</span></div>
        </Card>
      </div>

      <Modal isOpen={modal !== null} onClose={fecharModal} title={modalTitulo} description={modalDescricao} size="lg" footer={modalFooter}>
        {modal === "REGISTRO" && <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome do solicitante" value={novoChamado.solicitante} required onChange={(e) => setNovoChamado((v) => ({ ...v, solicitante: e.target.value }))} placeholder="Nome informado por telefone" />
            <Input label="Telefone para retorno" type="tel" value={novoChamado.telefone} required onChange={(e) => setNovoChamado((v) => ({ ...v, telefone: e.target.value }))} placeholder="(79) 9 0000-0000" />
            <Input label="Município / bairro" value={novoChamado.municipio} required onChange={(e) => setNovoChamado((v) => ({ ...v, municipio: e.target.value }))} placeholder="Ex.: Aracaju · Centro" />
            <Input label="Endereço da ocorrência" value={novoChamado.endereco} required onChange={(e) => setNovoChamado((v) => ({ ...v, endereco: e.target.value }))} placeholder="Rua, número, referência" />
            <Select label="Prioridade do chamado" value={novoChamado.urgencia} required onChange={(e) => setNovoChamado((v) => ({ ...v, urgencia: e.target.value as Chamado["urgencia"] }))} options={[{ value: "Rotina", label: "Rotina" }, { value: "Prioritário", label: "Prioritário" }]} />
          </div>
          <Textarea label="Relato inicial" value={novoChamado.relato} required rows={4} onChange={(e) => setNovoChamado((v) => ({ ...v, relato: e.target.value }))} placeholder="Registre as informações fornecidas durante a ligação." helperText="O chamado será salvo como aguardando triagem." />
        </div>}

        {modal === "TRIAGEM" && selecionado && <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><Detail label="Protocolo" value={selecionado.protocolo} /><Detail label="Solicitante / telefone" value={`${selecionado.solicitante} · ${selecionado.telefone}`} /><Detail label="Município / bairro" value={selecionado.municipio} /><Detail label="Endereço informado" value={selecionado.endereco} /></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Relato do atendimento</p><p className="mt-1 text-sm leading-relaxed text-slate-700">{selecionado.relato}</p></div>
          <Textarea label="Justificativa da decisão" value={justificativa} required rows={4} onChange={(e) => setJustificativa(e.target.value)} placeholder="Registre os critérios avaliados na triagem..." helperText="Mínimo de 8 caracteres. A justificativa fica registrada no chamado." />
          {justificativa.length > 0 && justificativa.trim().length < 8 && <p className="-mt-2 text-xs text-rose-600">A justificativa precisa ter pelo menos 8 caracteres.</p>}
        </div>}

        {modal === "ORDEM" && selecionado && <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Triagem aprovada</div><p className="mt-1 text-xs text-emerald-800">{selecionado.protocolo} · {selecionado.municipio}</p>{selecionado.justificativaTriagem && <p className="mt-2 text-xs leading-relaxed text-emerald-900">{selecionado.justificativaTriagem}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Viatura SVO" value={viaturaId} required onChange={(e) => { setViaturaId(e.target.value); setQuantidadeObitos("1"); }} placeholder="Selecione uma viatura" options={viaturasElegiveis.map((v) => ({ value: v.id, label: `${v.nome} · ${v.placa} · ${4 - v.ocupacao} vagas` }))} />
            <Select label="Quantidade de óbitos" value={quantidadeObitos} required disabled={!viaturaDaOrdem} onChange={(e) => setQuantidadeObitos(e.target.value)} options={Array.from({ length: Math.max(0, vagasRestantes) }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i === 0 ? "óbito" : "óbitos"}` }))} />
          </div>
          {viaturaDaOrdem ? <div className="grid gap-3 sm:grid-cols-2"><Detail label="Motorista responsável" value={viaturaDaOrdem.motorista} /><Detail label="Ocupação após alocação" value={`${viaturaDaOrdem.ocupacao + Number(quantidadeObitos)}/4 vagas`} /></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Não há viatura apta com capacidade disponível para emitir esta ordem.</div>}
          <p className="text-xs text-slate-500">A emissão da ordem atualiza a ocupação da viatura e registra o início da coleta.</p>
        </div>}

        {modal === "DETALHE" && selecionado && <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-slate-600">{selecionado.protocolo}</span><Badge variant={STATUS_VARIANT[selecionado.status]} dot>{STATUS_LABEL[selecionado.status]}</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2"><Detail label="Solicitante" value={selecionado.solicitante} /><Detail label="Telefone" value={selecionado.telefone} /><Detail label="Município / bairro" value={selecionado.municipio} /><Detail label="Endereço informado" value={selecionado.endereco} /></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Relato inicial</p><p className="mt-1 text-sm leading-relaxed text-slate-700">{selecionado.relato}</p></div>
          {selecionado.justificativaTriagem && <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Justificativa da triagem</p><p className="mt-1 text-sm leading-relaxed text-slate-700">{selecionado.justificativaTriagem}</p></div>}
          {selecionado.ordemId && <Detail label="Ordem de coleta emitida" value={selecionado.ordemId} />}
        </div>}
      </Modal>
    </div>
  );
};

function Metric({ icon: Icon, label, value, trend, caption, tone }: { icon: React.ElementType; label: string; value: string | number; trend?: string; caption: string; tone: "blue" | "amber" | "rose" | "green" }) {
  const palette = { blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", green: "bg-emerald-50 text-emerald-700" };
  return <Card className="rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-2"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", palette[tone])}><Icon className="h-5 w-5" /></span>{trend && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><ArrowUpRight className="h-3 w-3" />{trend}</span>}</div><p className="mt-4 text-[11px] font-semibold leading-snug text-slate-500 sm:text-xs">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{value}</p><span className="mb-1 text-[10px] text-slate-400">{caption}</span></div></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div>;
}
