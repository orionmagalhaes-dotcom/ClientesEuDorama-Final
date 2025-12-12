
import React, { useEffect, useState } from 'react';
import { User, AppCredential } from '../types';
import { getAssignedCredential } from '../services/credentialService';
import { getSystemConfig, SystemConfig, updateClientPreferences, updateClientName, getAllClients } from '../services/clientService';
import { CheckCircle, AlertCircle, Copy, RefreshCw, Check, Lock, CreditCard, ChevronRight, Star, Cast, Gamepad2, Rocket, X, Megaphone, Calendar, Clock, Crown, Zap, Palette, Upload, Image, Sparkles, Gift, AlertTriangle, Loader2, PlayCircle, Smartphone, Tv, ShoppingCart, RotateCw, Camera, Edit2, Trash2 } from 'lucide-react';

interface DashboardProps {
  user: User;
  onOpenSupport: () => void;
  onOpenDoraminha: () => void;
  onOpenCheckout: (type: 'renewal' | 'gift' | 'new_sub', targetService?: string) => void;
  onOpenGame: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showPalette: boolean; // Recebe estado do pai
  setShowPalette: (show: boolean) => void;
}

const COLORS = [
    { name: 'Rosa (Padrão)', value: '#ec4899', class: 'bg-pink-600', gradient: 'from-pink-500 to-pink-700', bgClass: 'bg-pink-50' },
    { name: 'Roxo', value: '#9333ea', class: 'bg-purple-600', gradient: 'from-purple-500 to-purple-700', bgClass: 'bg-purple-50' },
    { name: 'Azul', value: '#2563eb', class: 'bg-blue-600', gradient: 'from-blue-500 to-blue-700', bgClass: 'bg-blue-50' },
    { name: 'Verde', value: '#16a34a', class: 'bg-green-600', gradient: 'from-green-500 to-green-700', bgClass: 'bg-green-50' },
    { name: 'Laranja', value: '#ea580c', class: 'bg-orange-600', gradient: 'from-orange-500 to-orange-700', bgClass: 'bg-orange-50' },
    { name: 'Vermelho', value: '#dc2626', class: 'bg-red-600', gradient: 'from-red-500 to-red-700', bgClass: 'bg-red-50' },
    { name: 'Preto', value: '#111827', class: 'bg-gray-900', gradient: 'from-gray-800 to-black', bgClass: 'bg-gray-900' },
    { name: 'Ciano', value: '#06b6d4', class: 'bg-cyan-600', gradient: 'from-cyan-500 to-cyan-700', bgClass: 'bg-cyan-50' },
    { name: 'Indigo', value: '#4f46e5', class: 'bg-indigo-600', gradient: 'from-indigo-500 to-indigo-700', bgClass: 'bg-indigo-50' },
    { name: 'Rose', value: '#e11d48', class: 'bg-rose-600', gradient: 'from-rose-500 to-rose-700', bgClass: 'bg-rose-50' },
    { name: 'Violeta', value: '#7c3aed', class: 'bg-violet-600', gradient: 'from-violet-500 to-violet-700', bgClass: 'bg-violet-50' },
];

const SERVICE_CATALOG = [
    {
        id: 'Viki Pass',
        name: 'Viki Pass',
        benefits: ['Doramas Exclusivos', 'Sem Anúncios', 'Alta Qualidade (HD)', 'Acesso Antecipado'],
        price: 'R$ 19,90',
        color: 'from-blue-600 to-cyan-500',
        iconColor: 'bg-blue-600',
        shadow: 'shadow-blue-200'
    },
    {
        id: 'Kocowa+',
        name: 'Kocowa+',
        benefits: ['Shows de K-Pop Ao Vivo', 'Reality Shows Coreanos', 'Legendas Super Rápidas', '100% Coreano'],
        price: 'R$ 14,90',
        color: 'from-purple-600 to-indigo-600',
        iconColor: 'bg-purple-600',
        shadow: 'shadow-purple-200'
    },
    {
        id: 'IQIYI',
        name: 'IQIYI',
        benefits: ['Doramas Chineses (C-Drama)', 'Animes e BLs Exclusivos', 'Qualidade 4K e Dolby', 'Catálogo Gigante'],
        price: 'R$ 14,90',
        color: 'from-green-600 to-emerald-500',
        iconColor: 'bg-green-600',
        shadow: 'shadow-green-200'
    },
    {
        id: 'WeTV',
        name: 'WeTV',
        benefits: ['Séries Tencent Video', 'Mini Doramas Viciantes', 'Variedades Asiáticas', 'Dublagem em Português'],
        price: 'R$ 14,90',
        color: 'from-orange-500 to-red-500',
        iconColor: 'bg-orange-500',
        shadow: 'shadow-orange-200'
    },
    {
        id: 'DramaBox',
        name: 'DramaBox',
        benefits: ['Doramas Verticais (Shorts)', 'Episódios de 1 minuto', 'Histórias Intensas', 'Ideal para Celular'],
        price: 'R$ 14,90',
        color: 'from-pink-500 to-rose-500',
        iconColor: 'bg-pink-500',
        shadow: 'shadow-pink-200'
    }
];

const getCredentialStatus = (serviceName: string, day: number) => {
    const name = serviceName.toLowerCase();
    if (name.includes('viki')) {
        const daysLeft = 14 - day;
        if (day < 13) return { color: 'bg-blue-100 text-blue-700', text: `✨ Sua conta renova em ${daysLeft} dias!` };
        if (day === 13) return { color: 'bg-yellow-100 text-yellow-800', text: `⚠️ Amanhã trocamos a senha!` };
        if (day === 14) return { color: 'bg-orange-100 text-orange-800', text: `⏰ Último dia! Nova conta em breve.` };
        return { color: 'bg-red-100 text-red-800', text: `🚫 Aguardando nova conta...` };
    }
    if (name.includes('kocowa')) {
        const daysLeft = 30 - day;
        if (day < 20) return { color: 'bg-blue-100 text-blue-700', text: `🦋 Tudo tranquilo! Renova em ${daysLeft} dias.` };
        if (day >= 20 && day < 25) return { color: 'bg-yellow-100 text-yellow-800', text: `📅 Ciclo acabando em ${daysLeft} dias.` };
        return { color: 'bg-red-100 text-red-800', text: `🔄 Renovação iminente.` };
    }
    if (name.includes('iqiyi')) {
        const daysLeft = 30 - day;
        if (day < 29) return { color: 'bg-blue-100 text-blue-700', text: `🎋 Curta seus doramas! Renova em ${daysLeft} dias.` };
        return { color: 'bg-red-100 text-red-800', text: `🐉 Trocando a conta em breve!` };
    }
    return { color: 'bg-gray-100 text-gray-700', text: `Dia ${day} de uso.` };
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const updateLocalSession = (updates: Partial<User>) => {
    const session = localStorage.getItem('eudorama_session');
    if (session) {
        const current = JSON.parse(session);
        localStorage.setItem('eudorama_session', JSON.stringify({ ...current, ...updates }));
    }
};

const Dashboard: React.FC<DashboardProps> = ({ user, onOpenSupport, onOpenCheckout, onOpenGame, onRefresh, isRefreshing, showPalette, setShowPalette }) => {
  const [assignedCredentials, setAssignedCredentials] = useState<{service: string, cred: AppCredential | null, alert: string | null, daysActive: number}[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showStarInfo, setShowStarInfo] = useState(false);
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [themeColor, setThemeColor] = useState(user.themeColor || COLORS[0].class);
  const [bgImage, setBgImage] = useState(user.backgroundImage || '');
  const [profileImage, setProfileImage] = useState(user.profileImage || '');
  
  // Name Editing State
  const [userName, setUserName] = useState(user.name || 'Dorameira');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const getServiceName = (serviceString: string) => serviceString.split('|')[0].trim();
  const starsCount = Math.floor((user.completed?.length || 0) / 10);
  const userServicesLower = user.services.map(s => getServiceName(s).toLowerCase());
  const missingServices = SERVICE_CATALOG.filter(s => !userServicesLower.some(us => us.includes(s.id.toLowerCase())));

  const activeTheme = COLORS.find(c => c.class === themeColor) || COLORS[0];
  const bgStyle = bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : {}; 
  const containerClass = bgImage ? 'bg-black/50 min-h-screen pb-32 backdrop-blur-sm' : `${activeTheme.bgClass} min-h-screen pb-32 transition-colors duration-500 will-change-contents`;

  // Identificação do Usuário Demo (99999...) vs Teste Grátis (0000...)
  const isDemoAccount = user.phoneNumber.startsWith('99999');
  
  // Logic to split name for display (Stylized)
  const nameParts = userName ? userName.trim().split(' ').filter(Boolean) : [];
  const firstNameDisplay = nameParts[0] || (userName.trim() === '' ? '' : userName);
  const secondNameDisplay = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  useEffect(() => {
      // Se user.name for vazio, pode vir como '' ou undefined. 'Dorameira' é o default visual apenas se quisermos forçar.
      // Se o usuário limpou, respeitamos o vazio aqui, mas o backend pode ter 'Dorameira' se for padrão.
      // Aqui usamos user.name direto para respeitar o que veio do banco.
      setUserName(user.name || 'Dorameira');
      setProfileImage(user.profileImage || '');
  }, [user]);

  const calculateSubscriptionStatus = (serviceName: string) => {
      const cleanKey = getServiceName(serviceName);
      let details = user.subscriptionDetails ? user.subscriptionDetails[cleanKey] : null;
      let purchaseDate = details ? new Date(details.purchaseDate) : new Date(user.purchaseDate);
      if (isNaN(purchaseDate.getTime())) purchaseDate = new Date();
      let duration = details ? details.durationMonths : (user.durationMonths || 1);
      const expiryDate = new Date(purchaseDate);
      expiryDate.setMonth(purchaseDate.getMonth() + duration);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = daysLeft < 0;
      const isGracePeriod = isExpired && daysLeft >= -3;
      const isBlocked = user.isDebtor || (isExpired && !isGracePeriod && !user.overrideExpiration);
      return { expiryDate, daysLeft, isExpired, isGracePeriod, isBlocked };
  };

  const hasAnyBlockedService = user.services.some(svc => calculateSubscriptionStatus(svc).isBlocked);
  const hasAnyExpiredService = user.services.some(svc => calculateSubscriptionStatus(svc).isExpired);

  useEffect(() => {
    const loadCreds = async () => {
      setLoadingCreds(true);
      
      try {
          // PERFORMANCE FIX: Busca todos os clientes UMA vez para calcular as filas
          const [conf, allClients] = await Promise.all([
              getSystemConfig(),
              getAllClients()
          ]);
          
          setSysConfig(conf);
          
          const results = await Promise.all(user.services.map(async (rawService) => {
            const name = getServiceName(rawService);
            // Passa a lista allClients para evitar que a função busque tudo de novo para cada serviço
            const result = await getAssignedCredential(user, name, allClients);
            return { service: rawService, cred: result.credential, alert: result.alert, daysActive: result.daysActive || 0 };
          }));
          
          setAssignedCredentials(results);
      } catch(e) {
          console.error("Erro carregando dashboard", e);
      } finally {
          setLoadingCreds(false);
      }
    };
    loadCreds();
  }, [user]);

  const handleThemeChange = async (colorClass: string) => {
      setThemeColor(colorClass);
      updateLocalSession({ themeColor: colorClass });
      await updateClientPreferences(user.phoneNumber, { themeColor: colorClass });
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setUploadingImage(true);
          try {
              const compressedBase64 = await compressImage(file);
              setBgImage(compressedBase64);
              updateLocalSession({ backgroundImage: compressedBase64 });
              await updateClientPreferences(user.phoneNumber, { backgroundImage: compressedBase64 });
          } catch (error) { console.error(error); } finally { setUploadingImage(false); }
      }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setUploadingImage(true);
          try {
              const compressedBase64 = await compressImage(file);
              setProfileImage(compressedBase64);
              updateLocalSession({ profileImage: compressedBase64 });
              await updateClientPreferences(user.phoneNumber, { profileImage: compressedBase64 });
          } catch (error) { console.error(error); } finally { setUploadingImage(false); }
      }
  };

  const handleRemoveProfileImage = async () => {
      setProfileImage('');
      updateLocalSession({ profileImage: '' });
      await updateClientPreferences(user.phoneNumber, { profileImage: '' });
  };

  const handleSaveName = async () => {
      // PERMITIR NOME VAZIO: Removemos a validação !tempName.trim()
      setIsEditingName(false);
      const nameToSave = tempName; // Salva exatamente o que foi digitado, mesmo que vazio
      setUserName(nameToSave); // Optimistic UI update
      
      // Update local and remote
      updateLocalSession({ name: nameToSave });
      await updateClientName(user.phoneNumber, nameToSave);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: Date) => { try { return date.toLocaleDateString('pt-BR'); } catch (e) { return 'Data Inválida'; } };

  const handleServiceClick = (rawService: string) => {
      const name = getServiceName(rawService);
      const details = SERVICE_CATALOG.find(s => name.toLowerCase().includes(s.id.toLowerCase()));
      const { expiryDate } = calculateSubscriptionStatus(rawService);
      const cleanKey = getServiceName(rawService);
      const specPurchase = user.subscriptionDetails?.[cleanKey]?.purchaseDate ? new Date(user.subscriptionDetails[cleanKey].purchaseDate) : new Date(user.purchaseDate);
      const modalData = details ? { ...details, customExpiry: expiryDate, customPurchase: specPurchase } : { name: name, benefits: ['Acesso total'], price: 'R$ 14,90', color: 'from-gray-500 to-gray-700', customExpiry: expiryDate, customPurchase: specPurchase };
      setSelectedService(modalData);
  };
  
  const getBannerColor = (type: string) => {
      switch(type) {
          case 'warning': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
          case 'error': return 'bg-red-50 text-red-800 border-red-200';
          case 'success': return 'bg-green-50 text-green-800 border-green-200';
          default: return 'bg-blue-50 text-blue-800 border-blue-200';
      }
  };

  return (
    <div style={bgStyle}>
      <div className={containerClass}>
          
      {/* HEADER - CLEANER & LARGER */}
      <div className="flex justify-between items-center px-5 pt-6 pb-2">
          <div className="flex items-center gap-5 w-full">
              {/* PROFILE IMAGE with Edit Button */}
              <div className="relative group shrink-0">
                  <div className={`w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-xl relative ring-4 ring-pink-300`}>
                      <img src={profileImage || `https://ui-avatars.com/api/?name=${user.name}&background=random`} alt="Profile" className="w-full h-full object-cover will-change-transform" />
                      {uploadingImage && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
                      
                      {/* Hidden Input wrapped in full size label for clickability */}
                      <label className="absolute inset-0 cursor-pointer">
                          <input type="file" className="hidden" accept="image/*" onChange={handleProfileUpload} />
                      </label>
                  </div>
                  {/* Visual Camera Icon Badge */}
                  <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md border border-gray-200 pointer-events-none text-pink-600">
                      <Camera className="w-4 h-4" />
                  </div>
              </div>

              <div className="flex flex-col flex-1 min-w-0 justify-center">
                  {/* User Name with Inline Editing */}
                  {isEditingName ? (
                      <div className="flex items-center gap-2 py-1">
                          <input 
                              type="text" 
                              className="w-full bg-white/90 border-2 border-pink-300 rounded-lg px-2 py-1 text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500 shadow-lg placeholder-gray-400"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              autoFocus
                              maxLength={20}
                              placeholder="Seu nome..."
                          />
                          <button onClick={handleSaveName} className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-md transition-colors"><Check className="w-5 h-5"/></button>
                          <button onClick={() => setIsEditingName(false)} className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-colors"><X className="w-5 h-5"/></button>
                      </div>
                  ) : (
                      <div className="flex items-start gap-1 group/name cursor-pointer py-1 min-h-[40px]" onClick={() => { setTempName(userName); setIsEditingName(true); }}>
                          <div className="flex flex-col leading-none">
                              <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 tracking-tighter font-serif italic drop-shadow-sm">
                                  {firstNameDisplay}
                              </span>
                              {secondNameDisplay && (
                                  <span className="text-2xl font-bold text-gray-500 font-serif italic tracking-tight -mt-1 ml-0.5">
                                      {secondNameDisplay}
                                  </span>
                              )}
                              {!firstNameDisplay && <span className="text-gray-300 font-bold italic text-xl">Seu Nome</span>}
                          </div>
                          
                          <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400 animate-spin-slow flex-shrink-0 mt-2"/>
                          <div className="opacity-50 group-hover/name:opacity-100 transition-opacity p-1 bg-white/30 rounded-full hover:bg-white/50 mt-2">
                              <Edit2 className="w-3 h-3 text-gray-600" />
                          </div>
                      </div>
                  )}
                  
                  {/* Badges Row */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="relative w-max group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-200 animate-pulse"></div>
                          <div className="relative bg-white px-3 py-1 rounded-full flex items-center gap-1 border border-pink-100 shadow-sm">
                              <Crown className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-[bounce_2s_infinite]" />
                              <span className="text-[10px] font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600 uppercase tracking-widest">
                                  Membro VIP
                              </span>
                          </div>
                      </div>
                      
                      {/* RESTYLED STAR BADGE */}
                      <button 
                        onClick={() => setShowStarInfo(true)} 
                        className="relative w-max group active:scale-95 transition-transform" 
                        title="Ver Pontuação"
                      >
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-500 animate-pulse"></div>
                          <div className="relative bg-white px-3 py-1 rounded-full flex items-center gap-1 border border-yellow-200 shadow-sm hover:bg-yellow-50 transition-colors">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              <span className="text-[10px] font-extrabold text-yellow-700 uppercase tracking-widest">
                                  {starsCount} Estrelas
                              </span>
                          </div>
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* GAMIFICATION MODAL */}
      {showStarInfo && (
          <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border-4 border-yellow-300">
                  <button onClick={() => setShowStarInfo(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400"/></button>
                  <div className="text-center">
                      <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Star className="w-10 h-10 text-yellow-600 fill-yellow-500" /></div>
                      <h3 className="text-2xl font-black text-gray-900 mb-2">Suas Estrelas!</h3>
                      <p className="text-gray-600 mb-6 text-sm leading-relaxed">Você ganha <strong>1 Estrela</strong> a cada <strong>10 Doramas</strong> que marcar como "Finalizado".<br/><br/>Junte estrelas para desbloquear surpresas no futuro! Continue assistindo! 🎬✨</p>
                      <button onClick={() => setShowStarInfo(false)} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95">Entendi, vou maratonar!</button>
                  </div>
              </div>
          </div>
      )}

      {/* THEME PICKER DRAWER */}
      {showPalette && (
          <div className="mx-4 mt-2 bg-white p-4 rounded-2xl shadow-xl border-2 border-gray-100 animate-fade-in-up relative z-20">
              <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800 text-sm">Personalizar Aparência</h3>
                  <button onClick={() => setShowPalette(false)}><X className="w-4 h-4 text-gray-400"/></button>
              </div>
              
              <div className="space-y-4">
                  {/* Color Palette */}
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {COLORS.map(c => <button key={c.name} onClick={() => handleThemeChange(c.class)} className={`w-10 h-10 rounded-full flex-shrink-0 border-2 shadow-lg transition-all duration-300 ${c.class} ${themeColor === c.class ? 'border-white ring-2 ring-gray-900 scale-110 brightness-50' : 'border-transparent hover:scale-105'}`} title={c.name}></button>)}
                  </div>

                  {/* Image Actions */}
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                      {/* BG Upload */}
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 border border-gray-200 transition-colors">
                          {uploadingImage ? <Loader2 className="w-4 h-4 text-pink-500 animate-spin" /> : <Image className="w-4 h-4 text-gray-600" />}
                          <span className="text-xs font-bold text-gray-700">Trocar Fundo</span>
                          <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} disabled={uploadingImage} />
                      </label>

                      {/* Remove BG */}
                      {bgImage && (
                          <button onClick={() => {setBgImage(''); updateClientPreferences(user.phoneNumber, {backgroundImage: ''}); updateLocalSession({backgroundImage: ''}); }} className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl hover:bg-red-100 border border-red-100 transition-colors">
                              <Trash2 className="w-4 h-4 text-red-500" />
                              <span className="text-xs font-bold text-red-600">Remover Fundo</span>
                          </button>
                      )}

                      {/* Remove Profile Pic */}
                      {profileImage && (
                          <button onClick={handleRemoveProfileImage} className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl hover:bg-red-100 border border-red-100 transition-colors">
                              <Trash2 className="w-4 h-4 text-red-500" />
                              <span className="text-xs font-bold text-red-600">Remover Foto Perfil</span>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
      
      {/* SERVICE DETAIL MODAL */}
      {selectedService && (
          <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col">
                  <div className={`h-32 bg-gradient-to-r ${selectedService.color} relative p-6 flex flex-col justify-end`}><button onClick={() => setSelectedService(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md"><X className="w-5 h-5" /></button><h2 className="text-3xl font-black text-white drop-shadow-md">{selectedService.name}</h2></div>
                  <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                           <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center"><p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center justify-center gap-1"><Calendar className="w-3 h-3"/> Compra</p><p className="text-sm font-black text-gray-800">{formatDate(selectedService.customPurchase)}</p></div>
                           <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center"><p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3"/> Vence em</p><p className={`text-sm font-black text-gray-800`}>{formatDate(selectedService.customExpiry)}</p></div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center"><span className="text-xs font-bold text-gray-500 uppercase">Mensal</span><span className="text-xl font-black text-gray-900">{selectedService.price}</span></div>
                      <button onClick={() => setSelectedService(null)} className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-transform active:scale-95">Fechar Detalhes</button>
                  </div>
              </div>
          </div>
      )}

      {/* GLOBAL DEBT WARNING BANNER */}
      {hasAnyExpiredService && (
          <div className="mx-4 mt-4 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 shadow-md"><AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" /><div><p className="font-black text-red-800 text-sm uppercase mb-1">Atenção, Dorameira!</p><p className="text-xs text-red-700 font-medium leading-relaxed">Algumas assinaturas venceram. Você tem um <strong>prazo de tolerância de 3 dias</strong> para ver os logins vencidos. Após isso, o acesso será bloqueado até a renovação.</p><button onClick={() => onOpenCheckout('renewal')} className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95 hover:bg-red-700 transition-colors">Renovar Agora</button></div></div>
      )}

      {/* SYSTEM BANNER */}
      {sysConfig?.bannerActive && sysConfig.bannerText && (
          <div className={`mx-4 p-4 rounded-xl border flex items-start gap-3 shadow-sm animate-pulse-slow ${getBannerColor(sysConfig.bannerType)}`}><Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" /><div><p className="font-bold text-sm leading-tight">{sysConfig.bannerText}</p></div></div>
      )}

      <div className="px-4 space-y-6 pt-4">
        
        {/* SUAS ASSINATURAS */}
        <div className={`rounded-3xl p-5 border relative bg-white/95 backdrop-blur-md ${hasAnyBlockedService ? 'border-red-200' : 'border-white'}`}>
             <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                     <div className={`p-2.5 rounded-xl ${hasAnyBlockedService ? 'bg-red-200 text-red-700' : 'bg-green-100 text-green-700'}`}><CreditCard className="w-6 h-6" /></div>
                     <div><h3 className="font-bold text-gray-900 text-lg leading-none">Suas Assinaturas</h3><p className={`text-xs font-bold mt-1 ${hasAnyBlockedService ? 'text-red-600' : 'text-green-600'}`}>{hasAnyBlockedService ? 'Renovação Necessária' : 'Status Ativo'}</p></div>
                 </div>
             </div>
             <div className="flex flex-col gap-3">
                 {user.services.length > 0 ? user.services.map((rawSvc, i) => {
                     const name = getServiceName(rawSvc);
                     const details = SERVICE_CATALOG.find(s => name.toLowerCase().includes(s.id.toLowerCase()));
                     const iconBg = details?.iconColor || 'bg-gray-500';
                     const { expiryDate, isBlocked, isGracePeriod, daysLeft } = calculateSubscriptionStatus(rawSvc);
                     let statusText = `Vence: ${formatDate(expiryDate)}`;
                     let statusColor = "text-gray-500";
                     let dotColorClass = "bg-green-500"; 
                     if (daysLeft < 0) { dotColorClass = "bg-gray-900"; } else if (daysLeft <= 2) { dotColorClass = "bg-red-600"; }
                     if (isBlocked) { statusText = `Vencido há ${Math.abs(daysLeft)} dias`; statusColor = "text-red-600"; } else if (isGracePeriod) { statusText = `Tolerância (${Math.abs(daysLeft)} dias)`; statusColor = "text-orange-500"; }

                     return (
                         <div key={i} className={`w-full flex items-center justify-between p-3 rounded-xl border bg-white hover:shadow-md transition-all relative overflow-hidden ${isBlocked ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                            <button onClick={() => handleServiceClick(rawSvc)} className="flex items-center gap-3 relative z-10 flex-1 text-left">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${iconBg} shrink-0 text-lg`}>{name.substring(0,1).toUpperCase()}</div>
                                <div className="min-w-0"><span className="font-bold text-gray-900 text-base truncate block flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${dotColorClass} shadow-sm`}></div>{name}</span><span className={`text-[10px] font-bold ${statusColor}`}>{statusText}</span></div>
                            </button>
                            <button onClick={() => onOpenCheckout('renewal', name)} className={`ml-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 flex flex-col items-center gap-1 shadow-lg group ${isBlocked ? 'bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-red-200 animate-pulse' : 'bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-green-200 hover:shadow-green-300 hover:-translate-y-0.5'}`}>
                                <RefreshCw className={`w-4 h-4 ${!isBlocked && 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                Renovar
                            </button>
                         </div>
                     );
                 }) : (<div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300"><span className="text-xs text-gray-400 italic">Nenhum serviço ativo.</span></div>)}
             </div>
        </div>

        {/* CONNECT BUTTON - MOVED BELOW SUBSCRIPTIONS */}
        <button 
            onClick={onOpenSupport} 
            className="w-full bg-gradient-to-r from-pink-600 to-blue-600 rounded-2xl p-5 shadow-lg shadow-blue-200/50 text-white relative overflow-hidden group active:scale-[0.98] transition-all transform hover:-translate-y-1 hover:shadow-xl"
        >
            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 bg-white/20 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm"><div className="flex gap-1"><Tv className="w-6 h-6 text-white" /><Smartphone className="w-4 h-4 text-white self-end" /></div></div>
                    <div className="text-left"><h3 className="font-black text-lg leading-tight tracking-tight">Precisa de Ajuda?</h3><p className="text-blue-100 text-xs mt-1 font-semibold">Conectar na TV ou Celular</p></div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/80 group-hover:translate-x-1 transition-transform" />
            </div>
        </button>

        {/* ACCESS CREDENTIALS */}
        <div className="space-y-4 pt-2">
             <div className="flex items-center justify-between px-1"><h2 className="text-xl font-extrabold text-gray-800 flex items-center bg-white/50 px-3 py-1 rounded-lg backdrop-blur-sm"><div className={`w-1.5 h-6 rounded-full mr-3 ${activeTheme.class}`}></div>Suas Contas</h2>{loadingCreds && <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />}</div>
             <div className="grid gap-4">
               {!loadingCreds && !assignedCredentials.some(c => c.cred) && <p className="text-gray-500 text-sm bg-white p-6 rounded-xl text-center border border-gray-200 shadow-sm">Aguardando liberação de acesso.</p>}
               {assignedCredentials.map(({ service, cred, daysActive }, idx) => {
                 const name = getServiceName(service);
                 
                 // Lógica de Exibição Separada: 
                 // Demo (99999...) -> Falso
                 // Teste Grátis (0000...) -> Real
                 const displayEmail = isDemoAccount ? `demo_${name.toLowerCase()}@eudorama.com` : (cred?.email || 'Sem Acesso');
                 const displayPass = isDemoAccount ? 'demo1234' : (cred?.password || '---');
                 
                 const status = getCredentialStatus(name, daysActive);
                 const { isBlocked, daysLeft } = calculateSubscriptionStatus(service);
                 let dotColorClass = "bg-green-500"; if (daysLeft < 0) dotColorClass = "bg-gray-900"; else if (daysLeft <= 2) dotColorClass = "bg-red-600";

                 return cred ? (
                   <div key={idx} className={`bg-white rounded-2xl shadow-lg border overflow-hidden group transition-colors relative ${isBlocked ? 'border-red-200' : 'border-gray-200 hover:border-pink-300'}`}>
                     <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center"><span className="font-extrabold text-gray-800 text-lg flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${dotColorClass}`}></div>{name}</span>{isBlocked && <Lock className="w-4 h-4 text-red-500" />}</div>
                     {!isBlocked && (<div className={`px-5 py-2 ${status.color} text-xs font-bold flex items-center`}><Clock className="w-3 h-3 mr-2" />{status.text}</div>)}
                     <div className="p-5 flex flex-col gap-4 relative">
                        {isBlocked && (<div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 text-center rounded-b-2xl"><div className="flex flex-col items-center max-w-[200px]"><div className="bg-red-100 p-3 rounded-full mb-2 shadow-sm"><Lock className="w-6 h-6 text-red-600" /></div><h3 className="text-red-900 font-extrabold text-lg leading-tight mb-1">Acesso Pausado</h3><p className="text-red-700 text-[10px] font-medium mb-3 leading-snug">Tolerância de 3 dias expirou.</p><button onClick={() => onOpenCheckout('renewal')} className="bg-red-600 text-white w-full py-3 rounded-xl font-bold shadow-lg text-sm hover:bg-red-700 active:scale-95 transition-transform">Renovar para Liberar</button></div></div>)}
                        <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100 hover:bg-white transition-colors"><div className="overflow-hidden"><p className="text-[10px] text-gray-400 font-bold uppercase">Email</p><p className="text-base font-bold text-gray-900 truncate select-all">{isBlocked ? '•••••••••••' : displayEmail}</p></div><button disabled={isBlocked} onClick={() => copyToClipboard(displayEmail || '', cred.id + 'email')} className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-pink-600 transition-colors shadow-sm active:scale-90">{copiedId === cred.id + 'email' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}</button></div>
                        <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100 hover:bg-white transition-colors"><div className="overflow-hidden"><p className="text-[10px] text-gray-400 font-bold uppercase">Senha</p><p className="text-base font-bold text-gray-900 tracking-wider select-all">{isBlocked ? '••••••' : displayPass}</p></div><button disabled={isBlocked} onClick={() => copyToClipboard(displayPass || '', cred.id + 'pass')} className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-pink-600 transition-colors shadow-sm active:scale-90">{copiedId === cred.id + 'pass' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}</button></div>
                     </div>
                   </div>
                 ) : null;
               })}
             </div>
        </div>

        {/* --- MISSING SERVICES (REDESIGNED UPSELL - TICKET STYLE WITH BIG BUTTON) --- */}
        {missingServices.length > 0 && (
            <div className="space-y-4 pt-6 pb-4 border-t border-gray-200 bg-white/80 p-4 rounded-3xl backdrop-blur-sm">
                <div className="flex items-center justify-between px-1"><h2 className="text-xl font-extrabold text-gray-800 flex items-center"><Rocket className="w-6 h-6 text-orange-500 mr-2 animate-pulse" />Disponíveis para Assinar</h2></div>
                <div className="flex overflow-x-auto gap-4 pb-4 px-1 scrollbar-hide snap-x">
                    {missingServices.map((service) => (
                        <div key={service.id} className="snap-center min-w-[260px] max-w-[260px] h-[340px] rounded-3xl overflow-hidden relative shadow-xl group cursor-pointer transition-transform hover:scale-[1.02] flex flex-col" onClick={() => onOpenCheckout('new_sub', service.name)}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${service.color}`}></div>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                            <div className="relative h-[45%] p-5 flex flex-col justify-between z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
                                <div className="flex justify-between items-start"><div className="bg-white/20 p-2 rounded-xl backdrop-blur-md shadow-inner"><Crown className="w-6 h-6 text-white" /></div><span className="bg-black/30 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase backdrop-blur-sm border border-white/10">Premium</span></div>
                                <div><h3 className="text-2xl font-black text-white tracking-tight drop-shadow-md">{service.name}</h3><div className="w-10 h-1 bg-white/50 rounded-full mt-2"></div></div>
                            </div>
                            <div className="relative h-[55%] bg-white p-5 flex flex-col justify-between z-10">
                                <div className="space-y-2">{service.benefits.slice(0, 2).map((benefit, i) => (<div key={i} className="flex items-center text-xs text-gray-600 font-medium"><CheckCircle className={`w-4 h-4 mr-2 ${service.iconColor.replace('bg-', 'text-')}`} /><span className="truncate">{benefit}</span></div>))}</div>
                                <div className="mt-2 pt-3 border-t border-dashed border-gray-200">
                                    <div className="mb-2"><p className="text-[10px] uppercase font-bold text-gray-400">Mensal</p><p className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${service.color}`}>{service.price}</p></div>
                                    <button className={`w-full py-3 rounded-xl shadow-lg bg-gradient-to-r ${service.color} text-white font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-transform animate-pulse`}>
                                        <ShoppingCart className="w-4 h-4" /> COMPRAR AGORA
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Dashboard;
