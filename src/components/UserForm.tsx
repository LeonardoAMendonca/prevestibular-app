'use client';

// ============================================================
//  ARQUIVO: src/components/UserForm.tsx
//  Formulário completo de cadastro/edição de usuários (CIPOP)
//  Seções: Acesso, Dados Pessoais, Contato, Endereço,
//          Acadêmico/Profissional, Dados Bancários, Emergência
// ============================================================

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { postToGAS } from '@/lib/gasClient';
import { PjuUser, UserRole } from '@/contexts/AuthContext';

const EMPTY_USER: Partial<PjuUser> = {
    email: '', role: undefined, status: 'ativo', dataIngresso: new Date().toISOString().split('T')[0],
    nome: '', cpf: '', rg: '', dataNascimento: '', nacionalidade: 'Brasileira', fotoUrl: '',
    telefoneWhatsapp: '', telefoneSecundario: '',
    cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
    disciplina: '', instituicaoEnsino: '', curso: '', periodo: '',
    banco: '', agencia: '', conta: '', tipoConta: '', pix: '',
    contatoEmergenciaNome: '', contatoEmergenciaTelefone: '', contatoEmergenciaParentesco: '',
};

const ROLE_DESC: Record<string, string> = {
    ADMIN: 'Acesso total — gerencia usuários, alunos e sistema',
    COORDENAÇÃO: 'Cadastra e edita alunos, acessa relatórios',
    MONITOR: 'Registra presença e visualiza dados dos alunos',
    INSPETOR: 'Apenas visualiza dados, sem edição',
};

const BANCOS = [
    'Banco do Brasil', 'Bradesco', 'Caixa Econômica Federal', 'Itaú', 'Nubank',
    'Santander', 'Sicoob', 'Sicredi', 'Inter', 'C6 Bank', 'Neon', 'PicPay', 'Outro'
];

interface Props {
    user?: PjuUser | null;
    onClose: () => void;
    onSuccess: () => void;
}

function SectionTitle({ n, title }: { n: string; title: string }) {
    return (
        <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">{title}</h4>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
    );
}

function F({
    label, name, value, onChange, type = 'text', options,
    required, disabled, placeholder, half, onBlur,
}: {
    label: string; name: string; value: string;
    onChange: (n: string, v: string) => void;
    type?: string; options?: string[]; required?: boolean;
    disabled?: boolean; placeholder?: string; half?: boolean; onBlur?: () => void;
}) {
    const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 bg-white';
    return (
        <div className={half ? 'col-span-1' : ''}>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {label}{required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {options ? (
                <select name={name} value={value} disabled={disabled}
                    onChange={(e) => onChange(name, e.target.value)} className={cls}>
                    <option value="">Selecione...</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input type={type} name={name} value={value} disabled={disabled}
                    placeholder={placeholder} onBlur={onBlur}
                    onChange={(e) => onChange(name, e.target.value)} className={cls} />
            )}
        </div>
    );
}

export default function UserForm({ user, onClose, onSuccess }: Props) {
    const { currentUser, refreshData } = useAuth();
    const isEdit = !!user;

    const [form, setForm] = useState<Partial<PjuUser>>(
        user ? { ...EMPTY_USER, ...user } : EMPTY_USER
    );
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [fotoPreview, setFotoPreview] = useState<string>(user?.fotoUrl || '');
    const [uploadingFoto, setUploadingFoto] = useState(false);

    function handleChange(name: string, value: string) {
        setForm(prev => ({ ...prev, [name]: value }));
        setFeedback(null);
    }

    function handlePhone(name: string, value: string) {
        const d = value.replace(/\D/g, '').slice(0, 11);
        handleChange(name, d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'));
    }

    function handleCpf(value: string) {
        const d = value.replace(/\D/g, '').slice(0, 11);
        handleChange('cpf', d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'));
    }

    async function handleCepBlur() {
        const cep = form.cep?.replace(/\D/g, '');
        if (!cep || cep.length !== 8) return;
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) setForm(prev => ({
                ...prev,
                endereco: data.logradouro || prev.endereco,
                bairro: data.bairro || prev.bairro,
                cidade: data.localidade || prev.cidade,
                estado: data.uf || prev.estado,
            }));
        } catch { /* silencioso */ }
    }

    async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !currentUser) return;
        if (file.size > 2 * 1024 * 1024) {
            setFeedback({ type: 'error', message: 'Foto muito grande. Máximo: 2MB.' });
            return;
        }
        setUploadingFoto(true);
        try {
            const base64 = await toBase64(file);
            const res = await postToGAS('UPLOAD_PHOTO', {
                base64, filename: `usuario_${form.cpf || 'novo'}_${Date.now()}.${file.name.split('.').pop()}`,
                mimeType: file.type, folder: 'usuarios',
            }, currentUser.email);
            handleChange('fotoUrl', res.url);
            setFotoPreview(res.url);
        } catch {
            setFeedback({ type: 'error', message: 'Erro ao enviar foto. Tente novamente.' });
        } finally {
            setUploadingFoto(false);
        }
    }

    function toBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.email || !form.nome || !form.cpf || !form.role) {
            setFeedback({ type: 'error', message: 'E-mail, Nome, CPF e Perfil são obrigatórios.' });
            return;
        }
        if (!currentUser) return;
        setIsSaving(true);
        setFeedback(null);
        try {
            const action = isEdit ? 'UPDATE_USER' : 'ADD_USER';
            await postToGAS(action, form, currentUser.email);
            setFeedback({ type: 'success', message: isEdit ? 'Usuário atualizado!' : 'Usuário cadastrado!' });
            await refreshData();
            setTimeout(onSuccess, 1200);
        } catch (err) {
            setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro desconhecido.' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-1">

            {feedback && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium mb-4 ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {feedback.message}
                </div>
            )}

            {/* Foto */}
            <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {fotoPreview
                        ? <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                        : <span className="text-blue-600 text-2xl font-bold">{form.nome?.charAt(0) || '?'}</span>
                    }
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Foto do Usuário</label>
                    <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-white transition-colors ${uploadingFoto ? 'opacity-50' : ''}`}>
                        {uploadingFoto ? 'Enviando...' : '📷 Escolher foto'}
                        <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" disabled={uploadingFoto} />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">JPG ou PNG, máx. 2MB</p>
                </div>
            </div>

            {/* 1 — Acesso */}
            <SectionTitle n="1" title="Acesso ao Sistema" />
            <div className="grid grid-cols-2 gap-3">
                <F label="E-mail Google" name="email" type="email" value={form.email ?? ''}
                    onChange={handleChange} required disabled={isEdit}
                    placeholder="usuario@gmail.com" />
                <F label="Data de Ingresso" name="dataIngresso" type="date"
                    value={form.dataIngresso ?? ''} onChange={handleChange} />
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Perfil (Role) <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {(['ADMIN', 'COORDENAÇÃO', 'MONITOR', 'INSPETOR'] as UserRole[]).map(r => (
                            <button key={r} type="button"
                                onClick={() => handleChange('role', r)}
                                className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${form.role === r
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}>
                                <p className="font-semibold text-xs">{r}</p>
                                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{ROLE_DESC[r]}</p>
                            </button>
                        ))}
                    </div>
                </div>
                <F label="Status" name="status" value={form.status ?? 'ativo'}
                    onChange={handleChange} options={['ativo', 'inativo']} />
            </div>

            {/* 2 — Dados pessoais */}
            <SectionTitle n="2" title="Dados Pessoais" />
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <F label="Nome Completo" name="nome" value={form.nome ?? ''}
                        onChange={handleChange} required placeholder="Nome como no documento" />
                </div>
                <F label="CPF" name="cpf" value={form.cpf ?? ''}
                    onChange={(_, v) => handleCpf(v)} required
                    placeholder="000.000.000-00" disabled={isEdit} />
                <F label="RG" name="rg" value={form.rg ?? ''} onChange={handleChange} placeholder="00.000.000-0" />
                <F label="Data de Nascimento" name="dataNascimento" type="date"
                    value={form.dataNascimento ?? ''} onChange={handleChange} />
                <F label="Nacionalidade" name="nacionalidade" value={form.nacionalidade ?? ''}
                    onChange={handleChange} placeholder="Ex: Brasileira" />
            </div>

            {/* 3 — Contato */}
            <SectionTitle n="3" title="Contato" />
            <div className="grid grid-cols-2 gap-3">
                <F label="WhatsApp" name="telefoneWhatsapp" value={form.telefoneWhatsapp ?? ''}
                    onChange={(_, v) => handlePhone('telefoneWhatsapp', v)} placeholder="(00) 00000-0000" />
                <F label="Telefone Secundário" name="telefoneSecundario" value={form.telefoneSecundario ?? ''}
                    onChange={(_, v) => handlePhone('telefoneSecundario', v)} placeholder="(00) 00000-0000" />
            </div>

            {/* 4 — Endereço */}
            <SectionTitle n="4" title="Endereço" />
            <div className="grid grid-cols-2 gap-3">
                <F label="CEP" name="cep" value={form.cep ?? ''} onChange={handleChange}
                    placeholder="00000-000" onBlur={handleCepBlur} />
                <div /> {/* spacer */}
                <div className="col-span-2">
                    <F label="Logradouro" name="endereco" value={form.endereco ?? ''} onChange={handleChange} placeholder="Preenchido pelo CEP" />
                </div>
                <F label="Número" name="numero" value={form.numero ?? ''} onChange={handleChange} />
                <F label="Complemento" name="complemento" value={form.complemento ?? ''} onChange={handleChange} placeholder="Apto, Bloco..." />
                <F label="Bairro" name="bairro" value={form.bairro ?? ''} onChange={handleChange} />
                <F label="Cidade" name="cidade" value={form.cidade ?? ''} onChange={handleChange} />
                <F label="Estado" name="estado" value={form.estado ?? ''} onChange={handleChange}
                    options={['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']} />
            </div>

            {/* 5 — Acadêmico / Profissional */}
            <SectionTitle n="5" title="Acadêmico / Profissional" />
            <div className="grid grid-cols-2 gap-3">
                <F label="Disciplina(s) que leciona" name="disciplina" value={form.disciplina ?? ''}
                    onChange={handleChange} placeholder="Ex: Matemática, Física" />
                <F label="Instituição de Ensino" name="instituicaoEnsino" value={form.instituicaoEnsino ?? ''}
                    onChange={handleChange} placeholder="Universidade ou escola" />
                <F label="Curso" name="curso" value={form.curso ?? ''}
                    onChange={handleChange} placeholder="Ex: Engenharia Civil" />
                <F label="Período / Semestre" name="periodo" value={form.periodo ?? ''}
                    onChange={handleChange} placeholder="Ex: 5º período" />
            </div>

            {/* 6 — Dados bancários */}
            <SectionTitle n="6" title="Dados Bancários" />
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                <p className="text-xs text-amber-700">Necessário para recebimento de bolsas, auxílios e reembolsos.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <F label="Banco" name="banco" value={form.banco ?? ''} onChange={handleChange} options={BANCOS} />
                <F label="Tipo de conta" name="tipoConta" value={form.tipoConta ?? ''}
                    onChange={handleChange} options={['Conta Corrente', 'Conta Poupança', 'Conta de Pagamento']} />
                <F label="Agência" name="agencia" value={form.agencia ?? ''}
                    onChange={handleChange} placeholder="0000" />
                <F label="Número da conta" name="conta" value={form.conta ?? ''}
                    onChange={handleChange} placeholder="00000-0" />
                <div className="col-span-2">
                    <F label="Chave PIX" name="pix" value={form.pix ?? ''}
                        onChange={handleChange} placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </div>
            </div>

            {/* 7 — Contato de emergência */}
            <SectionTitle n="7" title="Contato de Emergência" />
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <F label="Nome" name="contatoEmergenciaNome" value={form.contatoEmergenciaNome ?? ''}
                        onChange={handleChange} placeholder="Nome completo" />
                </div>
                <F label="Telefone" name="contatoEmergenciaTelefone" value={form.contatoEmergenciaTelefone ?? ''}
                    onChange={(_, v) => handlePhone('contatoEmergenciaTelefone', v)} placeholder="(00) 00000-0000" />
                <F label="Grau de parentesco" name="contatoEmergenciaParentesco"
                    value={form.contatoEmergenciaParentesco ?? ''} onChange={handleChange}
                    options={['Pai', 'Mãe', 'Cônjuge', 'Irmão', 'Irmã', 'Avô', 'Avó', 'Tio', 'Tia', 'Amigo(a)', 'Outro']} />
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                <button type="button" onClick={onClose}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    Cancelar
                </button>
                <button type="submit" disabled={isSaving}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {isSaving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
            </div>
        </form>
    );
}