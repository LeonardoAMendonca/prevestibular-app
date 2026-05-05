'use client';

// ============================================================
//  ARQUIVO: src/components/StudentForm.tsx
//  Propósito: Formulário reutilizável para cadastrar e editar
//  alunos. Usado tanto na página /alunos/novo quanto em
//  /alunos/[cpf] (modo edição).
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { postToGAS } from '@/lib/gasClient';
import { Student } from '@/contexts/AuthContext';

const EMPTY_STUDENT: Partial<Student> = {
  cpf: '', nome: '', telefoneWhatsapp: '', telefoneSecundario: '',
  dataNascimento: '', cep: '', endereco: '', numero: '', bairro: '',
  cidade: '', estado: '', temFilhos: '', identidadeRacial: '',
  identidadeGenero: '', areaRiscoAmbiental: '', areaRiscoSeguranca: '',
  tipoMoradia: '', quantidadeMoradores: '', concluiuEnsinoMedio: '',
  instituicaoEnsinoMedio: '', anoConclusaoEnsinoMedio: '',
  tipoSanguineo: '', fotoUrl: '', statusMatricula: 'ativo',
};

interface StudentFormProps {
  initialData?: Partial<Student>;
  mode: 'add' | 'edit';
}

function Field({
  label, name, value, onChange, type = 'text',
  options, required, disabled, placeholder, onBlur,
}: {
  label: string; name: string; value: string;
  onChange: (name: string, value: string) => void;
  type?: string; options?: string[]; required?: boolean;
  disabled?: boolean; placeholder?: string; onBlur?: () => void;
}) {
  const base =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
    'disabled:bg-gray-50 disabled:text-gray-400 transition-shadow bg-white';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {options ? (
        <select name={name} value={value} disabled={disabled}
          onChange={(e) => onChange(name, e.target.value)}
          className={base}
        >
          <option value="">Selecione...</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={value} disabled={disabled}
          placeholder={placeholder} onBlur={onBlur}
          onChange={(e) => onChange(name, e.target.value)}
          className={base}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

export default function StudentForm({ initialData, mode }: StudentFormProps) {
  const { currentUser, refreshData } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<Partial<Student>>(
    initialData ? { ...EMPTY_STUDENT, ...initialData } : EMPTY_STUDENT
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function handleChange(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFeedback(null);
  }

  function handleCpfChange(value: string) {
    const d = value.replace(/\D/g, '').slice(0, 11);
    const f = d.replace(/(\d{3})(\d)/, '$1.$2')
               .replace(/(\d{3})(\d)/, '$1.$2')
               .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    handleChange('cpf', f);
  }

  function handlePhoneChange(name: string, value: string) {
    const d = value.replace(/\D/g, '').slice(0, 11);
    const f = d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
    handleChange(name, f);
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
      setFeedback({ type: 'success', message: mode === 'add' ? 'Aluno cadastrado com sucesso!' : 'Dados atualizados com sucesso!' });
      await refreshData();
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setFeedback({ type: 'error', message: 'Erro ao salvar: ' + msg });
    } finally {
      setIsSaving(false);
    }
  }

  const isReadOnly = mode === 'edit' && !['ADMIN', 'COORDENAÇÃO'].includes(currentUser?.role ?? '');

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
      {feedback && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {feedback.message}
        </div>
      )}

      <Section title="Identificação">
        <Field label="CPF" name="cpf" required value={form.cpf ?? ''}
          onChange={(_, v) => handleCpfChange(v)} disabled={mode === 'edit'} placeholder="000.000.000-00" />
        <div className="sm:col-span-2">
          <Field label="Nome Completo" name="nome" required value={form.nome ?? ''}
            onChange={handleChange} disabled={isReadOnly} placeholder="Nome como no documento" />
        </div>
        <Field label="Data de Nascimento" name="dataNascimento" type="date"
          value={form.dataNascimento ?? ''} onChange={handleChange} disabled={isReadOnly} />
        <Field label="Tipo Sanguíneo" name="tipoSanguineo" value={form.tipoSanguineo ?? ''}
          onChange={handleChange} disabled={isReadOnly}
          options={['A+','A-','B+','B-','AB+','AB-','O+','O-','Não sei']} />
        <Field label="Status de Matrícula" name="statusMatricula" value={form.statusMatricula ?? ''}
          onChange={handleChange} disabled={isReadOnly}
          options={['ativo','inativo','trancado','concluído']} />
      </Section>

      <Section title="Contato">
        <Field label="WhatsApp" name="telefoneWhatsapp" value={form.telefoneWhatsapp ?? ''}
          onChange={(_, v) => handlePhoneChange('telefoneWhatsapp', v)}
          disabled={isReadOnly} placeholder="(00) 00000-0000" />
        <Field label="Telefone Secundário" name="telefoneSecundario" value={form.telefoneSecundario ?? ''}
          onChange={(_, v) => handlePhoneChange('telefoneSecundario', v)}
          disabled={isReadOnly} placeholder="(00) 00000-0000" />
      </Section>

      <Section title="Endereço">
        <Field label="CEP" name="cep" value={form.cep ?? ''} onChange={handleChange}
          disabled={isReadOnly} placeholder="00000-000" onBlur={handleCepBlur} />
        <div className="sm:col-span-2">
          <Field label="Logradouro" name="endereco" value={form.endereco ?? ''} onChange={handleChange}
            disabled={isReadOnly} placeholder="Preenchido automaticamente pelo CEP" />
        </div>
        <Field label="Número" name="numero" value={form.numero ?? ''} onChange={handleChange} disabled={isReadOnly} />
        <Field label="Bairro" name="bairro" value={form.bairro ?? ''} onChange={handleChange} disabled={isReadOnly} />
        <Field label="Cidade" name="cidade" value={form.cidade ?? ''} onChange={handleChange} disabled={isReadOnly} />
        <Field label="Estado (UF)" name="estado" value={form.estado ?? ''} onChange={handleChange}
          disabled={isReadOnly}
          options={['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']} />
      </Section>

      <Section title="Perfil Social">
        <Field label="Identidade Racial" name="identidadeRacial" value={form.identidadeRacial ?? ''}
          onChange={handleChange} disabled={isReadOnly}
          options={['Amarela','Branca','Indígena','Parda','Preta','Prefiro não declarar']} />
        <Field label="Identidade de Gênero" name="identidadeGenero" value={form.identidadeGenero ?? ''}
          onChange={handleChange} disabled={isReadOnly}
          options={['Homem cisgênero','Mulher cisgênero','Homem trans','Mulher trans','Não binário','Prefiro não declarar']} />
        <Field label="Tem Filhos?" name="temFilhos" value={form.temFilhos ?? ''}
          onChange={handleChange} disabled={isReadOnly} options={['Sim','Não']} />
      </Section>

      <Section title="Moradia e Vulnerabilidade">
        <Field label="Tipo de Moradia" name="tipoMoradia" value={form.tipoMoradia ?? ''}
          onChange={handleChange} disabled={isReadOnly}
          options={['Própria','Alugada','Cedida','Ocupada','Outro']} />
        <Field label="Número de Moradores" name="quantidadeMoradores" value={form.quantidadeMoradores ?? ''}
          onChange={handleChange} disabled={isReadOnly} placeholder="Ex: 4" />
        <Field label="Área de Risco Ambiental?" name="areaRiscoAmbiental" value={form.areaRiscoAmbiental ?? ''}
          onChange={handleChange} disabled={isReadOnly} options={['Sim','Não','Não sei']} />
        <Field label="Área de Risco de Segurança?" name="areaRiscoSeguranca" value={form.areaRiscoSeguranca ?? ''}
          onChange={handleChange} disabled={isReadOnly} options={['Sim','Não','Não sei']} />
      </Section>

      <Section title="Escolaridade">
        <Field label="Concluiu Ensino Médio?" name="concluiuEnsinoMedio" value={form.concluiuEnsinoMedio ?? ''}
          onChange={handleChange} disabled={isReadOnly} options={['Sim','Não','Cursando']} />
        <Field label="Instituição do Ensino Médio" name="instituicaoEnsinoMedio" value={form.instituicaoEnsinoMedio ?? ''}
          onChange={handleChange} disabled={isReadOnly} placeholder="Nome da escola" />
        <Field label="Ano de Conclusão" name="anoConclusaoEnsinoMedio" value={form.anoConclusaoEnsinoMedio ?? ''}
          onChange={handleChange} disabled={isReadOnly} placeholder="Ex: 2023" />
      </Section>

      <Section title="Foto">
        <div className="sm:col-span-3">
          <Field label="URL da Foto (Google Drive)" name="fotoUrl" value={form.fotoUrl ?? ''}
            onChange={handleChange} disabled={isReadOnly} placeholder="https://drive.google.com/..." />
          <p className="text-xs text-gray-400 mt-1">
            Upload de foto será implementado na Fase 4. Por ora, cole o link público do Google Drive.
          </p>
        </div>
      </Section>

      {!isReadOnly && (
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {isSaving ? 'Salvando...' : mode === 'add' ? 'Cadastrar Aluno' : 'Salvar Alterações'}
          </button>
        </div>
      )}
    </form>
  );
}