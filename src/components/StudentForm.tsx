'use client';

// ============================================================
//  ARQUIVO: src/components/StudentForm.tsx
//  Formulário de matrícula reformulado conforme PDF oficial.
//  Seções: Dados Pessoais, Condição Socioeconômica, Saúde,
//          Contatos de Emergência, Responsável Legal (menores).
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { postToGAS } from '@/lib/gasClient';
import { Student } from '@/contexts/AuthContext';

// ─── Valor inicial vazio ──────────────────────────────────────
const EMPTY: Partial<Student> = {
  cpf: '', nome: '', email: '', dataNascimento: '',
  dataInscricao: new Date().toISOString().split('T')[0],
  telefoneWhatsapp: '', telefoneSecundario: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  identidadeRacial: '', identidadeGenero: '',
  areaRiscoAmbiental: '', areaRiscoSeguranca: '',
  tipoMoradia: '', tratamentoEsgoto: '',
  quantidadeMoradores: '', rendaFamiliar: '', rendaPerCapita: '',
  concluiuEnsinoMedio: '', anoConclusaoEnsinoMedio: '', serieAtual: '',
  tipoEscola: '', temFilhos: '', quantidadeFilhos: '',
  pessoaComDeficiencia: '', qualDeficiencia: '',
  tipoSanguineo: '', possuiAlergia: '', qualAlergia: '',
  usaMedicamento: '', qualMedicamento: '',
  contatoEmergencia1Nome: '', contatoEmergencia1Telefone: '', contatoEmergencia1Parentesco: '',
  contatoEmergencia2Nome: '', contatoEmergencia2Telefone: '', contatoEmergencia2Parentesco: '',
  responsavelNome: '', responsavelRG: '', responsavelCPF: '',
  responsavelNacionalidade: '', responsavelTelefone: '',
  fotoUrl: '', statusMatricula: 'ativo',
};

interface Props {
  initialData?: Partial<Student>;
  mode: 'add' | 'edit';
}

// ─── Componentes auxiliares ───────────────────────────────────

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">{title}</h3>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function Field({
  label, name, value, onChange, type = 'text', options,
  required, disabled, placeholder, onBlur, span,
  hint, readOnly,
}: {
  label: string; name: string; value: string;
  onChange: (name: string, value: string) => void;
  type?: string; options?: string[]; required?: boolean;
  disabled?: boolean; placeholder?: string; onBlur?: () => void;
  span?: 1 | 2 | 3; hint?: string; readOnly?: boolean;
}) {
  const colSpan = span === 3 ? 'col-span-3' : span === 2 ? 'col-span-2' : 'col-span-1';
  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ' +
    'disabled:bg-gray-50 disabled:text-gray-400 transition-all ' +
    (readOnly ? 'bg-blue-50 text-blue-700 font-medium cursor-not-allowed' : '');

  return (
    <div className={colSpan}>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {options ? (
        <select
          name={name} value={value} disabled={disabled || readOnly}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputClass}
        >
          <option value="">Selecione...</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type} name={name} value={value}
          disabled={disabled} readOnly={readOnly}
          placeholder={placeholder} onBlur={onBlur}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputClass}
        />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// Bloco de contato de emergência
function ContatoEmergencia({
  numero, nomeField, telefoneField, parentescoField,
  form, onChange, disabled,
}: {
  numero: 1 | 2;
  nomeField: keyof Student; telefoneField: keyof Student; parentescoField: keyof Student;
  form: Partial<Student>; onChange: (n: string, v: string) => void; disabled: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Contato de Emergência {numero}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Nome" name={nomeField} value={(form[nomeField] as string) ?? ''}
          onChange={onChange} disabled={disabled} placeholder="Nome completo" />
        <Field label="Telefone" name={telefoneField} value={(form[telefoneField] as string) ?? ''}
          onChange={(n, v) => {
            const d = v.replace(/\D/g, '').slice(0, 11);
            const f = d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
            onChange(n, f);
          }}
          disabled={disabled} placeholder="(00) 00000-0000" />
        <Field label="Grau de parentesco" name={parentescoField}
          value={(form[parentescoField] as string) ?? ''}
          onChange={onChange} disabled={disabled}
          options={['Pai','Mãe','Avô','Avó','Irmão','Irmã','Tio','Tia','Cônjuge','Outro']} />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────
export default function StudentForm({ initialData, mode }: Props) {
  const { currentUser, refreshData } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<Partial<Student>>(
    initialData ? { ...EMPTY, ...initialData } : EMPTY
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [uploadingFoto, setUploadingFoto] = useState(false);

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (file.size > 2 * 1024 * 1024) { 
      setFeedback({ type: 'error', message: 'Foto muito grande. Máximo: 2MB.' }); 
      return; 
    }
    setUploadingFoto(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const result = await postToGAS('UPLOAD_PHOTO', {
        base64, filename: `aluno_${form.cpf}_${Date.now()}.${file.name.split('.').pop()}`,
        mimeType: file.type, folder: 'alunos',
      }, currentUser.email);
      handleChange('fotoUrl', result.url);
    } catch { 
      setFeedback({ type: 'error', message: 'Erro ao enviar foto.' }); 
    } finally { 
      setUploadingFoto(false); 
    }
  }

  const isReadOnly = mode === 'edit' && !['ADMIN', 'COORDENAÇÃO'].includes(currentUser?.role ?? '');

  // Detecta se é menor de idade com base na data de nascimento
  const eMenorDeIdade = useMemo(() => {
    if (!form.dataNascimento) return false;
    const nasc = new Date(form.dataNascimento);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade < 18;
  }, [form.dataNascimento]);

  // Calcula renda per capita automaticamente
  useEffect(() => {
    const moradores = parseFloat(form.quantidadeMoradores ?? '');
    const renda = parseFloat((form.rendaFamiliar ?? '').replace(',', '.'));
    if (moradores > 0 && renda >= 0) {
      const perCapita = (renda / moradores).toFixed(2).replace('.', ',');
      setForm((prev) => ({ ...prev, rendaPerCapita: `R$ ${perCapita}` }));
    } else {
      setForm((prev) => ({ ...prev, rendaPerCapita: '' }));
    }
  }, [form.quantidadeMoradores, form.rendaFamiliar]);

  function handleChange(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFeedback(null);
  }

  function handleCpfChange(value: string) {
    const d = value.replace(/\D/g, '').slice(0, 11);
    handleChange('cpf', d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'));
  }

  function handlePhoneChange(name: string, value: string) {
    const d = value.replace(/\D/g, '').slice(0, 11);
    handleChange(name, d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'));
  }

  async function handleCepBlur() {
    const cep = form.cep?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro:   data.bairro     || prev.bairro,
          cidade:   data.localidade || prev.cidade,
          estado:   data.uf         || prev.estado,
        }));
      }
    } catch { /* falha silenciosa */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cpf || !form.nome) {
      setFeedback({ type: 'error', message: 'CPF e Nome são obrigatórios.' });
      return;
    }
    if (!currentUser) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const action = mode === 'add' ? 'ADD_STUDENT' : 'UPDATE_STUDENT';
      await postToGAS(action, form as Record<string, unknown>, currentUser.email);
      setFeedback({
        type: 'success',
        message: mode === 'add' ? 'Aluno matriculado com sucesso!' : 'Dados atualizados com sucesso!',
      });
      await refreshData();
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao salvar: ' + (err instanceof Error ? err.message : 'Erro desconhecido') });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          feedback.type === 'success'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* ── SEÇÃO 0: Data de inscrição ──────────────────────── */}
      <div className="flex items-center gap-4 py-4 px-5 bg-blue-50 rounded-xl border border-blue-100">
        <div>
          <label className="text-xs font-medium text-blue-600 uppercase tracking-wide block mb-1">Data de Inscrição</label>
          <input
            type="date"
            value={form.dataInscricao ?? ''}
            onChange={(e) => handleChange('dataInscricao', e.target.value)}
            disabled={isReadOnly}
            className="border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-blue-400">Status da matrícula</p>
          <select
            value={form.statusMatricula ?? 'ativo'}
            onChange={(e) => handleChange('statusMatricula', e.target.value)}
            disabled={isReadOnly}
            className="text-sm font-semibold border border-blue-200 rounded-lg px-3 py-2 bg-white text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {['ativo','inativo','trancado','concluído'].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── SEÇÃO 1: Dados Pessoais ─────────────────────────── */}
      <div>
        <SectionTitle number="1" title="Dados Pessoais" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="CPF" name="cpf" required value={form.cpf ?? ''}
            onChange={(_, v) => handleCpfChange(v)}
            disabled={mode === 'edit'} placeholder="000.000.000-00" />
          <Field label="Nome Completo" name="nome" required value={form.nome ?? ''}
            onChange={handleChange} disabled={isReadOnly}
            placeholder="Nome como no documento" span={2} />
          <Field label="Data de Nascimento" name="dataNascimento" type="date"
            value={form.dataNascimento ?? ''} onChange={handleChange} disabled={isReadOnly} />
          <Field label="E-mail" name="email" type="email" value={form.email ?? ''}
            onChange={handleChange} disabled={isReadOnly}
            placeholder="email@exemplo.com" span={2} />
          <Field label="WhatsApp" name="telefoneWhatsapp"
            value={form.telefoneWhatsapp ?? ''}
            onChange={(_, v) => handlePhoneChange('telefoneWhatsapp', v)}
            disabled={isReadOnly} placeholder="(00) 00000-0000" />
          <Field label="Telefone para Recados" name="telefoneSecundario"
            value={form.telefoneSecundario ?? ''}
            onChange={(_, v) => handlePhoneChange('telefoneSecundario', v)}
            disabled={isReadOnly} placeholder="(00) 00000-0000" />
        </div>

        {/* Sub-bloco endereço */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Endereço</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="CEP" name="cep" value={form.cep ?? ''}
              onChange={handleChange} disabled={isReadOnly}
              placeholder="00000-000" onBlur={handleCepBlur}
              hint="Preencha o CEP para completar automaticamente" />
            <Field label="Logradouro" name="endereco" value={form.endereco ?? ''}
              onChange={handleChange} disabled={isReadOnly}
              placeholder="Preenchido pelo CEP" span={2} />
            <Field label="Número" name="numero" value={form.numero ?? ''}
              onChange={handleChange} disabled={isReadOnly} />
            <Field label="Complemento" name="complemento" value={form.complemento ?? ''}
              onChange={handleChange} disabled={isReadOnly} placeholder="Apto, Bloco, Casa..." />
            <Field label="Bairro" name="bairro" value={form.bairro ?? ''}
              onChange={handleChange} disabled={isReadOnly} />
            <Field label="Cidade" name="cidade" value={form.cidade ?? ''}
              onChange={handleChange} disabled={isReadOnly} />
            <Field label="Estado (UF)" name="estado" value={form.estado ?? ''}
              onChange={handleChange} disabled={isReadOnly}
              options={['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']} />
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 2: Condição Socioeconômica ───────────────── */}
      <div>
        <SectionTitle number="2" title="Condição Socioeconômica" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Identidade Racial" name="identidadeRacial"
            value={form.identidadeRacial ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Amarela','Branca','Indígena','Parda','Preta','Prefiro não declarar']} />
          <Field label="Identidade de Gênero" name="identidadeGenero"
            value={form.identidadeGenero ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Mulher','Homem','Não binárie','Agênero','Outros']} />
          <div /> {/* spacer */}

          <Field label="Mora em área de risco ambiental?" name="areaRiscoAmbiental"
            value={form.areaRiscoAmbiental ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não','Não sei']} />
          <Field label="Mora em área de risco de segurança?" name="areaRiscoSeguranca"
            value={form.areaRiscoSeguranca ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não','Não sei']} />
          <Field label="Tipo de moradia" name="tipoMoradia"
            value={form.tipoMoradia ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Alugada','Própria','Cedida','Posse','Ocupação']} />

          <Field label="Moradia com tratamento de água e esgoto?" name="tratamentoEsgoto"
            value={form.tratamentoEsgoto ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não']} />
          <Field label="Pessoas na casa" name="quantidadeMoradores"
            value={form.quantidadeMoradores ?? ''} onChange={handleChange}
            disabled={isReadOnly} placeholder="Ex: 4" type="number" />
          <Field label="Renda familiar total (R$)" name="rendaFamiliar"
            value={form.rendaFamiliar ?? ''} onChange={handleChange}
            disabled={isReadOnly} placeholder="Ex: 2500,00"
            hint="Soma de todos os salários e rendas da casa" />

          {/* Renda per capita — somente leitura, calculada automaticamente */}
          <Field label="Renda per capita" name="rendaPerCapita"
            value={form.rendaPerCapita ?? ''} onChange={() => {}}
            readOnly
            hint="Calculada automaticamente (renda ÷ moradores)" />

          {/* Ensino médio — condicional */}
          <Field label="Concluiu o Ensino Médio?" name="concluiuEnsinoMedio"
            value={form.concluiuEnsinoMedio ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não','Cursando']} />
          {form.concluiuEnsinoMedio === 'Sim' && (
            <Field label="Ano de conclusão" name="anoConclusaoEnsinoMedio"
              value={form.anoConclusaoEnsinoMedio ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="Ex: 2023" type="number" />
          )}
          {(form.concluiuEnsinoMedio === 'Não' || form.concluiuEnsinoMedio === 'Cursando') && (
            <Field label="Série atual" name="serieAtual"
              value={form.serieAtual ?? ''} onChange={handleChange} disabled={isReadOnly}
              options={['1º ano','2º ano','3º ano','EJA']} />
          )}

          <Field label="Tipo de escola" name="tipoEscola"
            value={form.tipoEscola ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Escola Pública','Escola Privada','Colégio Militar']} />

          {/* Filhos — condicional */}
          <Field label="Possui filhos?" name="temFilhos"
            value={form.temFilhos ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não']} />
          {form.temFilhos === 'Sim' && (
            <Field label="Quantos filhos?" name="quantidadeFilhos"
              value={form.quantidadeFilhos ?? ''} onChange={handleChange}
              disabled={isReadOnly} type="number" placeholder="Ex: 2" />
          )}
        </div>
      </div>

      {/* ── SEÇÃO 3: Saúde ─────────────────────────────────── */}
      <div>
        <SectionTitle number="3" title="Saúde" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Deficiência — condicional */}
          <Field label="Pessoa com deficiência?" name="pessoaComDeficiencia"
            value={form.pessoaComDeficiencia ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não']} />
          {form.pessoaComDeficiencia === 'Sim' && (
            <Field label="Qual deficiência?" name="qualDeficiencia"
              value={form.qualDeficiencia ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="Descreva" span={2} />
          )}

          <Field label="Tipo Sanguíneo" name="tipoSanguineo"
            value={form.tipoSanguineo ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['A+','A-','B+','B-','AB+','AB-','O+','O-','Não sei']} />

          {/* Alergia — condicional */}
          <Field label="Possui alergia?" name="possuiAlergia"
            value={form.possuiAlergia ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não']} />
          {form.possuiAlergia === 'Sim' && (
            <Field label="Quais alergias?" name="qualAlergia"
              value={form.qualAlergia ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="Liste as alergias" span={2} />
          )}

          {/* Medicamento — condicional */}
          <Field label="Usa medicamento regular?" name="usaMedicamento"
            value={form.usaMedicamento ?? ''} onChange={handleChange} disabled={isReadOnly}
            options={['Sim','Não']} />
          {form.usaMedicamento === 'Sim' && (
            <Field label="Quais medicamentos?" name="qualMedicamento"
              value={form.qualMedicamento ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="Liste os medicamentos" span={2} />
          )}
        </div>

        {/* Contatos de emergência */}
        <div className="mt-4 space-y-3">
          <ContatoEmergencia numero={1}
            nomeField="contatoEmergencia1Nome"
            telefoneField="contatoEmergencia1Telefone"
            parentescoField="contatoEmergencia1Parentesco"
            form={form} onChange={handleChange} disabled={isReadOnly} />
          <ContatoEmergencia numero={2}
            nomeField="contatoEmergencia2Nome"
            telefoneField="contatoEmergencia2Telefone"
            parentescoField="contatoEmergencia2Parentesco"
            form={form} onChange={handleChange} disabled={isReadOnly} />
        </div>
      </div>

      {/* ── Foto do Aluno ─────────────────────────────────── */}
<div title="Foto">
  <div className="sm:col-span-3 flex items-center gap-4">
    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-gray-200">
      {form.fotoUrl
        ? <img src={form.fotoUrl} alt="Foto" className="w-full h-full object-cover" />
        : <span className="text-gray-400 text-3xl font-bold">{form.nome?.charAt(0) || '?'}</span>
      }
    </div>
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Foto do Aluno</label>
      <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors ${uploadingFoto ? 'opacity-50' : ''}`}>
        {uploadingFoto ? 'Enviando...' : '📷 Escolher foto'}
        <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" disabled={isReadOnly || uploadingFoto} />
      </label>
      <p className="text-xs text-gray-400 mt-1">JPG ou PNG, máx. 2MB. Salvo no Google Drive.</p>
    </div>
  </div>
</div>

      {/* ── SEÇÃO 4: Responsável Legal (menores de 18) ──────── */}
      {eMenorDeIdade && (
        <div>
          <SectionTitle number="4" title="Responsável Legal — Menor de Idade" />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-1 mb-4">
            <p className="text-xs text-amber-700 px-3 py-2">
              ⚠️ Aluno menor de 18 anos — preenchimento obrigatório.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nome do responsável" name="responsavelNome"
              value={form.responsavelNome ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="Nome completo" span={2} />
            <Field label="Nacionalidade" name="responsavelNacionalidade"
              value={form.responsavelNacionalidade ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="Ex: Brasileira" />
            <Field label="RG do responsável" name="responsavelRG"
              value={form.responsavelRG ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="00.000.000-0" />
            <Field label="CPF do responsável" name="responsavelCPF"
              value={form.responsavelCPF ?? ''} onChange={handleChange}
              disabled={isReadOnly} placeholder="000.000.000-00" />
            <Field label="Telefone do responsável" name="responsavelTelefone"
              value={form.responsavelTelefone ?? ''}
              onChange={(_, v) => handlePhoneChange('responsavelTelefone', v)}
              disabled={isReadOnly} placeholder="(00) 00000-0000" />
          </div>
        </div>
      )}

      {/* ── Botões ──────────────────────────────────────────── */}
      {!isReadOnly && (
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSaving}
            className="px-7 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {isSaving ? 'Salvando...' : mode === 'add' ? '✓ Realizar Matrícula' : '✓ Salvar Alterações'}
          </button>
        </div>
      )}
    </form>
  );
}