'use client';

// ============================================================
//  ARQUIVO: src/components/StudentForm.tsx
//  Atualizado: campos obrigatórios + seção de dados bancários
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { postToGAS } from '@/lib/gasClient';
import { resizeAndEncodeImage } from '@/lib/imageUtils';
import { Student } from '@/contexts/AuthContext';

const BANCOS = [
  'Banco do Brasil','Bradesco','Caixa Econômica Federal','Itaú','Nubank',
  'Santander','Sicoob','Sicredi','Inter','C6 Bank','Neon','PicPay','Outro'
];

const EMPTY: Partial<Student> = {
  cpf:'',nome:'',nomeMae:'',email:'',dataNascimento:'',
  dataInscricao: new Date().toISOString().split('T')[0],
  telefoneWhatsapp:'',telefoneSecundario:'',
  cep:'',endereco:'',numero:'',complemento:'',bairro:'',cidade:'',estado:'',
  identidadeRacial:'',identidadeGenero:'',
  areaRiscoAmbiental:'',areaRiscoSeguranca:'',
  tipoMoradia:'',tratamentoEsgoto:'',
  quantidadeMoradores:'',rendaFamiliar:'',rendaPerCapita:'',
  concluiuEnsinoMedio:'',anoConclusaoEnsinoMedio:'',serieAtual:'',
  tipoEscola:'',temFilhos:'',quantidadeFilhos:'',
  pessoaComDeficiencia:'',qualDeficiencia:'',
  tipoSanguineo:'',possuiAlergia:'',qualAlergia:'',
  usaMedicamento:'',qualMedicamento:'',
  contatoEmergencia1Nome:'',contatoEmergencia1Telefone:'',contatoEmergencia1Parentesco:'',
  contatoEmergencia2Nome:'',contatoEmergencia2Telefone:'',contatoEmergencia2Parentesco:'',
  banco:'',agencia:'',contaCorrente:'',tipoConta:'',pix:'',
  responsavelNome:'',responsavelRG:'',responsavelCPF:'',
  responsavelNacionalidade:'',responsavelTelefone:'',
  fotoUrl:'',statusMatricula:'ativo',
};

// Campos obrigatórios com suas mensagens de erro
const REQUIRED_FIELDS: { field: keyof Student; label: string; check?: (v: string) => boolean }[] = [
  { field: 'cpf',          label: 'CPF' },
  { field: 'nome',         label: 'Nome Completo' },
  { field: 'email',        label: 'E-mail' },
  { field: 'dataNascimento', label: 'Data de Nascimento' },
  { field: 'endereco',     label: 'Endereço (Logradouro)' },
  { field: 'numero',       label: 'Número do endereço' },
  { field: 'bairro',       label: 'Bairro' },
  { field: 'cidade',       label: 'Cidade' },
  {
    field: 'rendaFamiliar',
    label: 'Renda Familiar (deve ser maior que zero)',
    check: (v) => parseFloat(v.replace(',', '.')) > 0,
  },
];

interface Props { initialData?: Partial<Student>; mode: 'add' | 'edit'; }

function SectionTitle({ number, title, required }: { number: string; title: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{number}</div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">{title}</h3>
      {required && <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Obrigatório</span>}
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function Field({ label, name, value, onChange, type='text', options, required, disabled, placeholder, onBlur, span, hint, readOnly, error }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void;
  type?: string; options?: string[]; required?: boolean; disabled?: boolean;
  placeholder?: string; onBlur?: () => void; span?: 1|2|3; hint?: string; readOnly?: boolean; error?: boolean;
}) {
  const colSpan = span===3?'col-span-3':span===2?'col-span-2':'col-span-1';
  const cls = `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:border-transparent bg-white disabled:bg-gray-50 disabled:text-gray-400 transition-all ${
    error ? 'border-red-400 focus:ring-red-400 bg-red-50' :
    readOnly ? 'border-blue-200 bg-blue-50 text-blue-700 font-medium cursor-not-allowed focus:ring-blue-300' :
    'border-gray-200 focus:ring-blue-500'
  }`;
  return (
    <div className={colSpan}>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {options
        ? <select name={name} value={value} disabled={disabled||readOnly} onChange={e=>onChange(name,e.target.value)} className={cls}>
            <option value="">Selecione...</option>
            {options.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        : <input type={type} name={name} value={value} disabled={disabled} readOnly={readOnly}
            placeholder={placeholder} onBlur={onBlur} onChange={e=>onChange(name,e.target.value)} className={cls} />
      }
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
    </div>
  );
}

function ContatoEmergencia({ numero, nomeField, telefoneField, parentescoField, form, onChange, disabled }: {
  numero: 1|2; nomeField: keyof Student; telefoneField: keyof Student; parentescoField: keyof Student;
  form: Partial<Student>; onChange: (n: string, v: string) => void; disabled: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contato de Emergência {numero}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Nome" name={nomeField as string} value={(form[nomeField] as string)??''} onChange={onChange} disabled={disabled} placeholder="Nome completo" />
        <Field label="Telefone" name={telefoneField as string} value={(form[telefoneField] as string)??''}
          onChange={(n,v)=>{ const d=v.replace(/\D/g,'').slice(0,11); onChange(n,d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2')); }}
          disabled={disabled} placeholder="(00) 00000-0000" />
        <Field label="Grau de parentesco" name={parentescoField as string} value={(form[parentescoField] as string)??''}
          onChange={onChange} disabled={disabled} options={['Pai','Mãe','Avô','Avó','Irmão','Irmã','Tio','Tia','Cônjuge','Outro']} />
      </div>
    </div>
  );
}

export default function StudentForm({ initialData, mode }: Props) {
  const { currentUser, refreshData } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Partial<Student>>(initialData ? { ...EMPTY, ...initialData } : EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success'|'error'; message: string }|null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const isReadOnly = mode==='edit' && !['ADMIN','COORDENAÇÃO'].includes(currentUser?.role??'');

  const eMenorDeIdade = useMemo(() => {
    if (!form.dataNascimento) return false;
    const nasc=new Date(form.dataNascimento),hoje=new Date();
    let idade=hoje.getFullYear()-nasc.getFullYear();
    const m=hoje.getMonth()-nasc.getMonth();
    if (m<0||(m===0&&hoje.getDate()<nasc.getDate())) idade--;
    return idade<18;
  }, [form.dataNascimento]);

  useEffect(() => {
    const moradores=parseFloat(form.quantidadeMoradores??'');
    const renda=parseFloat((form.rendaFamiliar??'').replace(',','.'));
    if (moradores>0&&renda>=0) setForm(p=>({...p,rendaPerCapita:`R$ ${(renda/moradores).toFixed(2).replace('.',',')}`}));
    else setForm(p=>({...p,rendaPerCapita:''}));
  }, [form.quantidadeMoradores, form.rendaFamiliar]);

  function handleChange(name: string, value: string) {
    setForm(p=>({...p,[name]:value}));
    setFieldErrors(prev=>{ const n=new Set(prev); n.delete(name); return n; });
    setFeedback(null);
  }
  function handlePhone(name: string, v: string) { const d=v.replace(/\D/g,'').slice(0,11); handleChange(name,d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2')); }
  function handleCpf(v: string) { const d=v.replace(/\D/g,'').slice(0,11); handleChange('cpf',d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')); }

  async function handleCepBlur() {
    const cep=form.cep?.replace(/\D/g,'');
    if (!cep||cep.length!==8) return;
    try { const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); const d=await r.json(); if (!d.erro) setForm(p=>({...p,endereco:d.logradouro||p.endereco,bairro:d.bairro||p.bairro,cidade:d.localidade||p.cidade,estado:d.uf||p.estado})); } catch {}
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];
    if (!file||!currentUser) return;
    if (!file.type.startsWith('image/')) { setFeedback({type:'error',message:'Envie uma imagem (JPG, PNG ou WebP).'}); return; }
    setUploadingFoto(true);
    try {
      const { base64, mimeType } = await resizeAndEncodeImage(file, { maxWidth:800, maxHeight:800, quality:0.82 });
      const result = await postToGAS('UPLOAD_PHOTO', { base64, mimeType, filename:`aluno_${(form.cpf??'novo').replace(/\D/g,'')}_${Date.now()}.jpg`, folder:'alunos' }, currentUser.email);
      handleChange('fotoUrl', result.url);
    } catch { setFeedback({type:'error',message:'Erro ao enviar foto. Tente novamente.'}); }
    finally { setUploadingFoto(false); e.target.value=''; }
  }

  function validateForm(): boolean {
    const errors = new Set<string>();
    for (const { field, label, check } of REQUIRED_FIELDS) {
      const value = (form[field] as string) ?? '';
      if (!value.trim() || (check && !check(value))) {
        errors.add(field as string);
      }
    }
    setFieldErrors(errors);
    if (errors.size > 0) {
      const firstError = REQUIRED_FIELDS.find(f => errors.has(f.field as string));
      setFeedback({ type: 'error', message: `Preencha o campo obrigatório: ${firstError?.label}` });
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    if (!currentUser) return;
    setIsSaving(true); setFeedback(null);
    try {
      await postToGAS(mode==='add'?'ADD_STUDENT':'UPDATE_STUDENT', form as Record<string,unknown>, currentUser.email);
      setFeedback({type:'success',message:mode==='add'?'Aluno matriculado com sucesso!':'Dados atualizados com sucesso!'});
      await refreshData();
      setTimeout(()=>router.push('/dashboard'),1500);
    } catch (err) { setFeedback({type:'error',message:'Erro: '+(err instanceof Error?err.message:'Desconhecido')}); }
    finally { setIsSaving(false); }
  }

  const fe = (field: string) => fieldErrors.has(field);
  const ufs=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {feedback && <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${feedback.type==='success'?'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-700 border-red-200'}`}>{feedback.message}</div>}

      {/* Cabeçalho: data + status */}
      <div className="flex items-center gap-4 py-4 px-5 bg-blue-50 rounded-xl border border-blue-100">
        <div>
          <label className="text-xs font-medium text-blue-600 uppercase tracking-wide block mb-1">Data de Inscrição</label>
          <input type="date" value={form.dataInscricao??''} disabled={isReadOnly} onChange={e=>handleChange('dataInscricao',e.target.value)} className="border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-blue-400 mb-1">Status</p>
          <select value={form.statusMatricula??'ativo'} disabled={isReadOnly} onChange={e=>handleChange('statusMatricula',e.target.value)} className="text-sm font-semibold border border-blue-200 rounded-lg px-3 py-2 bg-white text-blue-700 focus:outline-none">
            {['ativo','inativo','trancado','concluído'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* 1 — Dados Pessoais */}
      <div>
        <SectionTitle number="1" title="Dados Pessoais" required />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="CPF" name="cpf" required value={form.cpf??''} onChange={(_,v)=>handleCpf(v)} disabled={mode==='edit'} placeholder="000.000.000-00" error={fe('cpf')} />
          <Field label="Nome Completo" name="nome" required value={form.nome??''} onChange={handleChange} disabled={isReadOnly} placeholder="Nome como no documento" span={2} error={fe('nome')} />
          <Field label="Nome Completo da Mãe" name="nomeMae" value={form.nomeMae??''} onChange={handleChange} disabled={isReadOnly} placeholder="Nome completo da mãe" span={2}/>
          <Field label="Data de Nascimento" name="dataNascimento" type="date" required value={form.dataNascimento??''} onChange={handleChange} disabled={isReadOnly} error={fe('dataNascimento')} />
          <Field label="E-mail" name="email" type="email" required value={form.email??''} onChange={handleChange} disabled={isReadOnly} placeholder="email@exemplo.com" span={2} error={fe('email')} />
          <Field label="WhatsApp" name="telefoneWhatsapp" value={form.telefoneWhatsapp??''} onChange={(_,v)=>handlePhone('telefoneWhatsapp',v)} disabled={isReadOnly} placeholder="(00) 00000-0000" />
          <Field label="Telefone para Recados" name="telefoneSecundario" value={form.telefoneSecundario??''} onChange={(_,v)=>handlePhone('telefoneSecundario',v)} disabled={isReadOnly} placeholder="(00) 00000-0000" />
        </div>
        {/* Endereço */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Endereço <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="CEP" name="cep" value={form.cep??''} onChange={handleChange} disabled={isReadOnly} placeholder="00000-000" onBlur={handleCepBlur} hint="Preencha para completar automaticamente" />
            <Field label="Logradouro" name="endereco" required value={form.endereco??''} onChange={handleChange} disabled={isReadOnly} placeholder="Preenchido pelo CEP" span={2} error={fe('endereco')} />
            <Field label="Número" name="numero" required value={form.numero??''} onChange={handleChange} disabled={isReadOnly} error={fe('numero')} />
            <Field label="Complemento" name="complemento" value={form.complemento??''} onChange={handleChange} disabled={isReadOnly} placeholder="Apto, Bloco, Casa..." />
            <Field label="Bairro" name="bairro" required value={form.bairro??''} onChange={handleChange} disabled={isReadOnly} error={fe('bairro')} />
            <Field label="Cidade" name="cidade" required value={form.cidade??''} onChange={handleChange} disabled={isReadOnly} error={fe('cidade')} />
            <Field label="Estado (UF)" name="estado" value={form.estado??''} onChange={handleChange} disabled={isReadOnly} options={ufs} />
          </div>
        </div>
      </div>

      {/* 2 — Condição Socioeconômica */}
      <div>
        <SectionTitle number="2" title="Condição Socioeconômica" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Identidade Racial" name="identidadeRacial" value={form.identidadeRacial??''} onChange={handleChange} disabled={isReadOnly} options={['Amarela','Branca','Indígena','Parda','Preta','Prefiro não declarar']} />
          <Field label="Identidade de Gênero" name="identidadeGenero" value={form.identidadeGenero??''} onChange={handleChange} disabled={isReadOnly} options={['Mulher','Homem','Não binárie','Agênero','Outros']} />
          <div/>
          <Field label="Risco Ambiental?" name="areaRiscoAmbiental" value={form.areaRiscoAmbiental??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não','Não sei']} />
          <Field label="Risco de Segurança?" name="areaRiscoSeguranca" value={form.areaRiscoSeguranca??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não','Não sei']} />
          <Field label="Tipo de Moradia" name="tipoMoradia" value={form.tipoMoradia??''} onChange={handleChange} disabled={isReadOnly} options={['Alugada','Própria','Cedida','Posse','Ocupação']} />
          <Field label="Tratamento de água e esgoto?" name="tratamentoEsgoto" value={form.tratamentoEsgoto??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não']} />
          <Field label="Pessoas na casa" name="quantidadeMoradores" type="number" value={form.quantidadeMoradores??''} onChange={handleChange} disabled={isReadOnly} placeholder="Ex: 4" />
          <Field label="Renda familiar total (R$)" name="rendaFamiliar" required value={form.rendaFamiliar??''} onChange={handleChange} disabled={isReadOnly} placeholder="Ex: 2500,00" hint="Soma de todos os rendimentos. Deve ser maior que zero." error={fe('rendaFamiliar')} />
          <Field label="Renda per capita" name="rendaPerCapita" value={form.rendaPerCapita??''} onChange={()=>{}} readOnly hint="Calculada automaticamente" />
          <Field label="Concluiu o Ensino Médio?" name="concluiuEnsinoMedio" value={form.concluiuEnsinoMedio??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não','Cursando']} />
          {form.concluiuEnsinoMedio==='Sim' && <Field label="Ano de conclusão" name="anoConclusaoEnsinoMedio" type="number" value={form.anoConclusaoEnsinoMedio??''} onChange={handleChange} disabled={isReadOnly} placeholder="Ex: 2023" />}
          {(form.concluiuEnsinoMedio==='Não'||form.concluiuEnsinoMedio==='Cursando') && <Field label="Série atual" name="serieAtual" value={form.serieAtual??''} onChange={handleChange} disabled={isReadOnly} options={['1º ano','2º ano','3º ano','EJA']} />}
          <Field label="Tipo de escola" name="tipoEscola" value={form.tipoEscola??''} onChange={handleChange} disabled={isReadOnly} options={['Escola Pública','Escola Privada','Colégio Militar']} />
          <Field label="Possui filhos?" name="temFilhos" value={form.temFilhos??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não']} />
          {form.temFilhos==='Sim' && <Field label="Quantos filhos?" name="quantidadeFilhos" type="number" value={form.quantidadeFilhos??''} onChange={handleChange} disabled={isReadOnly} placeholder="Ex: 2" />}
        </div>
      </div>

      {/* 3 — Saúde */}
      <div>
        <SectionTitle number="3" title="Saúde" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Pessoa com deficiência?" name="pessoaComDeficiencia" value={form.pessoaComDeficiencia??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não']} />
          {form.pessoaComDeficiencia==='Sim' && <Field label="Qual deficiência?" name="qualDeficiencia" value={form.qualDeficiencia??''} onChange={handleChange} disabled={isReadOnly} placeholder="Descreva" span={2} />}
          <Field label="Tipo Sanguíneo" name="tipoSanguineo" value={form.tipoSanguineo??''} onChange={handleChange} disabled={isReadOnly} options={['A+','A-','B+','B-','AB+','AB-','O+','O-','Não sei']} />
          <Field label="Possui alergia?" name="possuiAlergia" value={form.possuiAlergia??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não']} />
          {form.possuiAlergia==='Sim' && <Field label="Quais alergias?" name="qualAlergia" value={form.qualAlergia??''} onChange={handleChange} disabled={isReadOnly} placeholder="Liste" span={2} />}
          <Field label="Usa medicamento regular?" name="usaMedicamento" value={form.usaMedicamento??''} onChange={handleChange} disabled={isReadOnly} options={['Sim','Não']} />
          {form.usaMedicamento==='Sim' && <Field label="Quais medicamentos?" name="qualMedicamento" value={form.qualMedicamento??''} onChange={handleChange} disabled={isReadOnly} placeholder="Liste" span={2} />}
        </div>
        <div className="mt-4 space-y-3">
          <ContatoEmergencia numero={1} nomeField="contatoEmergencia1Nome" telefoneField="contatoEmergencia1Telefone" parentescoField="contatoEmergencia1Parentesco" form={form} onChange={handleChange} disabled={isReadOnly} />
          <ContatoEmergencia numero={2} nomeField="contatoEmergencia2Nome" telefoneField="contatoEmergencia2Telefone" parentescoField="contatoEmergencia2Parentesco" form={form} onChange={handleChange} disabled={isReadOnly} />
        </div>
      </div>

      {/* 4 — Dados Bancários */}
      <div>
        <SectionTitle number="4" title="Dados Bancários"/>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700">Necessário para prestação de contas e recebimento de auxílios.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Banco" name="banco" value={form.banco??''} onChange={handleChange} disabled={isReadOnly} options={BANCOS}/>
          <Field label="Agência" name="agencia" value={form.agencia??''} onChange={handleChange} disabled={isReadOnly} placeholder="0000"/>
          <Field label="Conta Corrente" name="contaCorrente" value={form.contaCorrente??''} onChange={handleChange} disabled={isReadOnly} placeholder="00000-0"/>
          <Field label="Tipo de Conta" name="tipoConta" value={form.tipoConta??''} onChange={handleChange} disabled={isReadOnly} options={['Conta Corrente','Conta Poupança','Conta de Pagamento']} />
          <Field label="Chave PIX" name="pix" value={form.pix??''} onChange={handleChange} disabled={isReadOnly} placeholder="CPF, e-mail, telefone ou chave aleatória" span={2} />
        </div>
      </div>

      {/* 5 — Foto */}
      <div>
        <SectionTitle number="5" title="Foto do Aluno" />
        <div className="flex items-center gap-6 p-5 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 bg-white flex items-center justify-center">
            {form.fotoUrl ? <img src={form.fotoUrl} alt="Foto" className="w-full h-full object-cover"/> : <span className="text-gray-300 text-4xl font-bold">{form.nome?.charAt(0)||'?'}</span>}
          </div>
          <div className="flex-1">
            {!isReadOnly ? (
              <>
                <label className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl border-2 border-dashed transition-colors ${uploadingFoto?'border-blue-200 text-blue-400 bg-blue-50':'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}>
                  {uploadingFoto?<><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>Enviando...</>:<>📷 {form.fotoUrl?'Trocar foto':'Escolher foto'}</>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoChange} className="hidden" disabled={uploadingFoto} />
                </label>
                <p className="text-xs text-gray-400 mt-2">JPG, PNG ou WebP · Redimensionado e salvo no Google Drive</p>
                {form.fotoUrl && <a href={form.fotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline mt-1 inline-block">Ver foto atual ↗</a>}
              </>
            ) : (
              <div>
                <p className="text-sm text-gray-500">{form.fotoUrl?'Foto cadastrada.':'Nenhuma foto cadastrada.'}</p>
                {form.fotoUrl && <a href={form.fotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline mt-1 inline-block">Ver foto ↗</a>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6 — Responsável Legal (menores) */}
      {eMenorDeIdade && (
        <div>
          <SectionTitle number="6" title="Responsável Legal — Menor de Idade" required />
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4"><p className="text-xs text-amber-700">⚠️ Aluno menor de 18 anos — preenchimento obrigatório.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nome do responsável" name="responsavelNome" value={form.responsavelNome??''} onChange={handleChange} disabled={isReadOnly} placeholder="Nome completo" span={2} />
            <Field label="Nacionalidade" name="responsavelNacionalidade" value={form.responsavelNacionalidade??''} onChange={handleChange} disabled={isReadOnly} placeholder="Ex: Brasileira" />
            <Field label="RG do responsável" name="responsavelRG" value={form.responsavelRG??''} onChange={handleChange} disabled={isReadOnly} placeholder="00.000.000-0" />
            <Field label="CPF do responsável" name="responsavelCPF" value={form.responsavelCPF??''} onChange={handleChange} disabled={isReadOnly} placeholder="000.000.000-00" />
            <Field label="Telefone do responsável" name="responsavelTelefone" value={form.responsavelTelefone??''} onChange={(_,v)=>handlePhone('responsavelTelefone',v)} disabled={isReadOnly} placeholder="(00) 00000-0000" />
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
          <button type="button" onClick={()=>router.back()} className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={isSaving||uploadingFoto} className="px-7 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {isSaving?'Salvando...':uploadingFoto?'Aguardando foto...':mode==='add'?'✓ Realizar Matrícula':'✓ Salvar Alterações'}
          </button>
        </div>
      )}
    </form>
  );
}