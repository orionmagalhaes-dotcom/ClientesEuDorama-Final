
import React, { useState } from 'react';
import { User } from '../types';
import { checkUserStatus, loginWithPassword, registerClientPassword, verifyAdminLogin, getRotationalTestPassword } from '../services/clientService';
import { Loader2, Lock, AlertCircle, UserCheck, Shield, Sparkles, Play, ChevronRight, Star } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User, remember: boolean, isTest?: boolean) => void;
  onAdminClick: () => void;
  onAdminLoginSuccess?: (remember: boolean) => void;
}

// --- TEMA E DESIGN SYSTEM (OTIMIZADO: SEM BLUR, CORES CLARAS) ---
interface Theme {
    name: string;
    bgClass: string;
    cardClass: string;
    textClass: string;
    subTextClass: string;
    inputContainerClass: string;
    inputTextClass: string;
    inputPlaceholderClass: string;
    buttonClass: string;
    iconColor: string;
    accentColor: string;
    bgElement?: React.ReactNode;
}

const THEMES: Theme[] = [
    {
        name: "Original Aura (Light)",
        // Fundo degradê bem suave e claro
        bgClass: "bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100", 
        // Card branco sólido sem blur
        cardClass: "bg-white border border-pink-200 shadow-xl", 
        // Texto escuro para contraste no fundo claro
        textClass: "text-gray-800", 
        subTextClass: "text-pink-600",
        inputContainerClass: "bg-pink-50 border border-pink-200 focus-within:border-pink-400 focus-within:bg-white",
        inputTextClass: "text-gray-900",
        inputPlaceholderClass: "placeholder-pink-300",
        buttonClass: "bg-pink-500 hover:bg-pink-600 text-white shadow-pink-200",
        iconColor: "text-pink-500",
        accentColor: "text-pink-600",
        bgElement: (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Elementos decorativos simples sem blur pesado */}
              <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-pink-200 rounded-full opacity-40"></div>
              <div className="absolute top-[60%] -right-[10%] w-[30%] h-[30%] bg-purple-200 rounded-full opacity-40"></div>
          </div>
        )
    }
];

const Login: React.FC<LoginProps> = ({ onLogin, onAdminClick, onAdminLoginSuccess }) => {
  const [step, setStep] = useState<'identify' | 'password' | 'create_password'>('identify');
  
  // User Login State
  const [digits, setDigits] = useState('');
  const [fullPhoneFound, setFullPhoneFound] = useState('');
  const [foundProfile, setFoundProfile] = useState<{name?: string, photo?: string} | null>(null);
  const [password, setPassword] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Admin inputs
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Tema fixo (Padrão Claro)
  const theme = THEMES[0];

  // --- HANDLERS ---
  
  const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
      setDigits(val);
      if (error) setError('');
  };

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (digits === '0000') {
        setShowAdmin(true);
        return;
    }

    if (digits.length < 4) {
      setError('Preencha os 4 dígitos finais.');
      return;
    }

    setLoading(true);
    
    try {
        const status = await checkUserStatus(digits);

        if (status.exists && status.phoneMatches.length > 0) {
            setFullPhoneFound(status.phoneMatches[0]);
            
            // Set profile data if available
            if (status.profile) {
                setFoundProfile(status.profile);
            } else {
                setFoundProfile(null);
            }

            if (status.hasPassword) {
                setStep('password');
            } else {
                setStep('create_password');
            }
        } else {
            setError('Conta não encontrada.');
        }
    } catch (err) {
        setError('Erro de conexão.');
    } finally {
        setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) { setError('Digite a senha.'); return; }
    setLoading(true);
    // Determine if this is a test session based on the phone number
    const isTest = fullPhoneFound === '00000000000';
    
    const { user, error: loginError } = await loginWithPassword(fullPhoneFound, password);
    setLoading(false);
    
    if (user) {
        onLogin(user, true, isTest);
    } else {
        setError(loginError || 'Senha incorreta.');
    }
  };

  const handleRegisterPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (password.length < 4) { setError('Mínimo 4 dígitos.'); return; }
      setLoading(true);
      const success = await registerClientPassword(fullPhoneFound, password);
      if (success) {
          const { user } = await loginWithPassword(fullPhoneFound, password);
          setLoading(false);
          if (user) onLogin(user, true);
          else setError('Erro ao entrar.');
      } else {
          setLoading(false);
          setError('Erro ao salvar.');
      }
  };

  const handleFreeTest = () => {
      // Configura o estado para o usuário de teste
      setFullPhoneFound('00000000000');
      setFoundProfile({ 
          name: 'Teste Grátis', 
          photo: 'https://ui-avatars.com/api/?name=Teste&background=random' 
      });
      // Avança para a tela de senha para EXIGIR a senha rotativa
      setStep('password');
      setDigits('');
      setError('');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const isValid = await verifyAdminLogin(adminUser, adminPass);
      if (isValid) {
          if (onAdminLoginSuccess) onAdminLoginSuccess(false);
          else onAdminClick();
      } else {
          const testPass = getRotationalTestPassword();
          if (adminPass.toUpperCase() === testPass) {
               // LOGIN COM SENHA DE TESTE VIA PAINEL ADMIN
               setFullPhoneFound('00000000000');
               const { user } = await loginWithPassword('00000000000', adminPass);
               if(user) onLogin(user, false, true);
               else setError('Erro ao carregar usuário de teste.');
          } else {
              setError('Acesso negado.');
          }
      }
  };

  // --- RENDERIZAR TELA DE ADMIN ---
  if (showAdmin) {
      return (
          <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 font-sans">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm animate-fade-in">
                  <h2 className="text-2xl font-bold mb-4 text-center text-gray-900">Admin / Teste</h2>
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                      <input type="text" placeholder="User" className="w-full border p-3 rounded-xl bg-gray-50 text-gray-900" value={adminUser} onChange={e => setAdminUser(e.target.value)} />
                      <input type="password" placeholder="Pass/Code" className="w-full border p-3 rounded-xl bg-gray-50 text-gray-900" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                      {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setShowAdmin(false)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold">Voltar</button>
                          <button type="submit" className="flex-1 bg-black text-white py-3 rounded-xl font-bold">Entrar</button>
                      </div>
                  </form>
              </div>
          </div>
      );
  }

  // --- RENDERIZAR TELA DE LOGIN COM TEMA ---
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center font-sans px-4 relative overflow-hidden transition-all duration-700 ${theme.bgClass}`}>
      
      {/* BACKGROUND ELEMENTS (Custom per theme) */}
      {theme.bgElement}

      {/* --- ADMIN LINK (TOP LEFT) --- */}
      <div className="absolute top-4 left-4 z-50">
          <button 
            onClick={() => setShowAdmin(true)}
            className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all px-3 py-2 rounded-full opacity-60 hover:opacity-100 hover:bg-white/20 ${theme.subTextClass}`}
          >
            <Shield className="w-3 h-3" /> Área Restrita
          </button>
      </div>

      <div className={`w-full max-w-sm p-8 space-y-6 animate-fade-in-up relative z-10 transition-all duration-500 ${theme.cardClass}`}>
        
        {/* LOGO AREA */}
        <div className="text-center pt-2">
            <div className="flex items-center justify-center gap-2 mb-2">
                <div className={`p-2.5 rounded-xl shadow-md animate-bounce ${theme.iconColor.includes('text-white') ? 'bg-white/20' : 'bg-current/10'} ${theme.iconColor}`}>
                    <Play className="w-6 h-6 fill-current" />
                </div>
                <h1 className={`text-3xl font-black tracking-tighter drop-shadow-sm ${theme.textClass}`}>
                    Eu<span className={theme.accentColor.replace('text-', 'text-opacity-90 text-')}>Dorama</span>
                </h1>
            </div>
            <p className={`text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1 opacity-80 ${theme.subTextClass}`}>
                <Sparkles className="w-3 h-3" /> Clube de Assinantes
            </p>
        </div>

        {step === 'identify' ? (
            <form onSubmit={handleIdentify} className="space-y-6">
                
                <div className="space-y-4">
                    <div className="text-center space-y-1">
                        <label className={`text-lg font-bold block leading-tight ${theme.textClass}`}>
                            Use os 4 últimos dígitos do seu WhatsApp
                        </label>
                        <p className={`text-sm font-bold opacity-100 ${theme.subTextClass}`}>
                            Ex: Se seu número é (88) 99999-<b>1234</b>, digite <b>1234</b>
                        </p>
                    </div>
                    
                    {/* INPUT COM MÁSCARA FIXA VISUAL */}
                    <div className={`rounded-xl p-4 flex items-center justify-center relative group transition-all ${theme.inputContainerClass}`}>
                        <span className={`text-xl font-bold tracking-widest select-none font-mono opacity-40 ${theme.inputTextClass}`}>
                            (••) ••••• - 
                        </span>
                        <input
                            type="tel"
                            maxLength={4}
                            placeholder="____"
                            className={`w-24 bg-transparent text-center text-xl font-bold outline-none tracking-[0.2em] font-mono focus:placeholder-transparent ml-1 ${theme.inputTextClass} ${theme.inputPlaceholderClass}`}
                            value={digits}
                            onChange={handleDigitsChange}
                            autoFocus
                        />
                    </div>
                </div>

                {error && (
                    <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-xs bg-red-50 border border-red-100 p-3 rounded-xl animate-pulse">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                <div className="space-y-3">
                    <button
                        type="submit"
                        disabled={loading || digits.length < 4}
                        className={`w-full font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group ${theme.buttonClass}`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuar <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/></>}
                    </button>
                    
                    {/* Botão Teste Grátis - Agora EXIGE SENHA */}
                    <button
                        type="button"
                        onClick={handleFreeTest}
                        className={`w-full py-3 font-bold text-xs rounded-xl transition-all flex justify-center items-center gap-2 active:scale-95 border border-dashed hover:border-solid ${theme.subTextClass} border-current opacity-70 hover:opacity-100`}
                    >
                         <Star className="w-3 h-3 fill-current" /> Quero testar grátis
                    </button>
                </div>

            </form>
        ) : (
            // PASSWORD STEP
            <form onSubmit={step === 'password' ? handleLoginSubmit : handleRegisterPassword} className="space-y-6 animate-slide-up">
                
                <div className={`text-center p-4 rounded-xl border ${theme.inputContainerClass}`}>
                    
                    {/* CONDITIONAL PROFILE DISPLAY */}
                    {foundProfile?.photo ? (
                        <div className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white/50 shadow-lg overflow-hidden">
                            <img src={foundProfile.photo} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 opacity-20 bg-current ${theme.iconColor}`}>
                            <UserCheck className="w-6 h-6" />
                        </div>
                    )}

                    <p className={`text-[10px] font-bold uppercase mb-1 opacity-60 ${theme.subTextClass}`}>Identificado como</p>
                    
                    {foundProfile?.name ? (
                        <p className={`font-black text-xl tracking-tight ${theme.textClass}`}>{foundProfile.name}</p>
                    ) : (
                        <p className={`font-bold text-lg tracking-widest font-mono ${theme.textClass}`}>••• •••• {fullPhoneFound.slice(-4)}</p>
                    )}
                </div>

                <div className={`rounded-xl p-4 transition-all ${theme.inputContainerClass}`}>
                    <label className={`block text-[10px] font-bold uppercase mb-2 ml-1 opacity-70 ${theme.subTextClass}`}>
                        {step === 'create_password' ? 'Crie sua senha' : 'Sua senha'}
                    </label>
                    <div className="flex items-center">
                        <Lock className={`w-5 h-5 mr-3 ml-1 opacity-50 ${theme.iconColor}`} />
                        <input
                            type="password"
                            className={`w-full bg-transparent font-bold text-xl outline-none ${theme.inputTextClass} ${theme.inputPlaceholderClass}`}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                            placeholder={fullPhoneFound === '00000000000' ? "Senha Rotativa" : "******"}
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                        <p className="text-red-600 font-bold text-center text-xs">{error}</p>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 ${theme.buttonClass}`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === 'create_password' ? 'Definir Senha e Entrar' : <>Acessar Painel <UserCheck className="w-4 h-4"/></>)}
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={() => { setStep('identify'); setDigits(''); setPassword(''); setError(''); setFoundProfile(null); }}
                        className={`font-bold text-xs py-2 transition-colors hover:underline opacity-70 hover:opacity-100 ${theme.subTextClass}`}
                    >
                        Não sou este número
                    </button>
                </div>
            </form>
        )}

      </div>
    </div>
  );
};

export default Login;
