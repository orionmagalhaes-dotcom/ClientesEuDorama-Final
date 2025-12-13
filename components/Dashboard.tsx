
import React, { useEffect, useState } from 'react';
import { User, AppCredential } from '../types';
import { getAssignedCredential } from '../services/credentialService';
import { getSystemConfig, SystemConfig, updateClientPreferences, updateClientName, getAllClients } from '../services/clientService';
import { CheckCircle, AlertCircle, Copy, RefreshCw, Check, Lock, CreditCard, ChevronRight, Star, Cast, Gamepad2, Rocket, X, Megaphone, Calendar, Clock, Crown, Zap, Palette, Upload, Image, Sparkles, Gift, AlertTriangle, Loader2, PlayCircle, Smartphone, Tv, ShoppingCart, RotateCw, Camera, Edit2, Trash2, MessageCircle } from 'lucide-react';

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

  // Logic to split name for display (Stylized)
  const nameParts = userName ? userName.trim().split(' ').filter(Boolean) : [];
  const firstNameDisplay = nameParts[0] || (userName.trim() === '' ? '' : userName);
  const secondNameDisplay = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  useEffect(() => {
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
          const [conf, allClients] = await Promise.all([
              getSystemConfig(),
              getAllClients()
          ]);
          setSysConfig(conf);
          const results = await Promise.all(user.services.map(async (rawService) => {
            const name = getServiceName(rawService);
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
      setIsEditingName(false);
      const nameToSave = tempName; 
      setUserName(nameToSave); 
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
                     
                     let badgeClass = "bg-gray-100 text-gray-700";
                     let badgeContent;
                     let buttonContent = null;

                     if (isBlocked) { 
                         // ACABOU A TOLERÂNCIA
                         badgeClass = "bg-red-50 text-red-700 border border-red-100";
                         badgeContent = (
                             <>
                                 <span className="text-[9px] font-black uppercase block opacity-80 leading-none mb-0.5 tracking-wider">ACESSO BLOQUEADO</span>
                                 <span className="text-xs font-bold block leading-tight">Renove Agora</span>
                             </>
                         );
                         buttonContent = (
                              <button 
                                 onClick={(e) => { e.stopPropagation(); onOpenCheckout('renewal', name); }}
                                 className="mt-1.5 w-full bg-red-600 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg shadow-md shadow-red-200 animate-pulse active:scale-95 transition-transform flex items-center justify-center gap-1"
                             >
                                 RENOVAR <RotateCw className="w-3 h-3 animate-spin-slow" />
                             </button>
                         );
                     } else if (isGracePeriod) { 
                         // VENCEU (TOLERÂNCIA)
                         badgeClass = "bg-orange-50 text-orange-800 border border-orange-100";
                         badgeContent = (
                             <>
                                 <span className="text-[9px] font-black uppercase block opacity-80 leading-none mb-0.5 tracking-wider">VENCEU (TOLERÂNCIA)</span>
                                 <span className="text-xs font-bold block leading-tight">{daysLeft === 0 ? 'Último Dia' : `${Math.abs(daysLeft)} Dias Restantes`}</span>
                             </>
                         );
                         buttonContent = (
                              <button 
                                 onClick={(e) => { e.stopPropagation(); onOpenCheckout('renewal', name); }}
                                 className="mt-1.5 w-full bg-orange-500 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg shadow-sm active:scale-95 transition-transform"
                             >
                                 Renovar
                             </button>
                         );
                     } else {
                         // NORMAL
                         badgeClass = "bg-blue-50 text-blue-700 border border-blue-100";
                         badgeContent = (
                             <>
                                 <span className="text-[9px] font-bold uppercase block opacity-80 leading-none mb-0.5 tracking-wider">VENCIMENTO</span>
                                 <span className="text-xs font-black block leading-tight">{formatDate(expiryDate)}</span>
                             </>
                         );
                     }

                     return (
                         <div key={i} className={`w-full flex items-center justify-between p-3 rounded-xl border bg-white hover:shadow-md transition-all relative overflow-hidden ${isBlocked ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                            <button onClick={() => handleServiceClick(rawSvc)} className="flex items-center gap-3 relative z-10 flex-1 text-left">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${iconBg} shrink-0 text-lg`}>{name.substring(0,1).toUpperCase()}</div>
                                <div className="min-w-0 flex-1">
                                    <span className="font-bold text-gray-900 text-base truncate block">{name}</span>
                                    <span className="text-xs text-gray-500 block truncate">{details?.benefits?.[0] || 'Acesso Premium'}</span>
                                </div>
                            </button>
                            
                            {/* DATA DE VENCIMENTO DESTACADA */}
                            <div className="flex flex-col items-end gap-1 ml-3 relative z-10 w-32">
                                <div className={`px-2 py-1.5 rounded-lg border text-center w-full ${badgeClass}`}>
                                    {badgeContent}
                                </div>
                                {buttonContent}
                            </div>
                         </div>
                     );
                 }) : (
                     <div className="text-center p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                         <p className="text-gray-500 font-bold mb-2">Você ainda não tem assinaturas ativas.</p>
                         <button onClick={() => onOpenCheckout('new_sub')} className="text-xs bg-gray-900 text-white px-4 py-2 rounded-lg font-bold">Ver Planos</button>
                     </div>
                 )}
             </div>
        </div>

        {/* ... (Resto do componente: catálogo, suporte, etc.) ... */}
        
        {/* CATÁLOGO DE NOVOS SERVIÇOS (Se houver faltando) */}
        {missingServices.length > 0 && (
            <div className="mt-6">
                <div className="flex items-center gap-2 mb-3 px-1">
                    <Rocket className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-gray-800">Adicionar ao seu Plano</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {missingServices.map(svc => (
                        <div key={svc.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${svc.color} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150`}></div>
                            <h4 className="font-bold text-gray-900 text-sm mb-1 relative z-10">{svc.name}</h4>
                            <p className="text-[10px] text-gray-500 mb-3 relative z-10 h-8 overflow-hidden">{svc.benefits[0]}</p>
                            <button 
                                onClick={() => onOpenCheckout('new_sub', svc.name)}
                                className={`w-full py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all bg-gradient-to-r ${svc.color}`}
                            >
                                Assinar {svc.price}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* BOTOES DE ACAO RAPIDA */}
        <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={onOpenSupport} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all">
                <div className="bg-green-100 p-2 rounded-full"><MessageCircle className="w-6 h-6 text-green-600" /></div>
                <span className="text-xs font-bold text-gray-700">Assistente IA</span>
            </button>
            <button onClick={onOpenGame} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all relative overflow-hidden">
                <div className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-bounce">NOVO</div>
                <div className="bg-purple-100 p-2 rounded-full"><Gamepad2 className="w-6 h-6 text-purple-600" /></div>
                <span className="text-xs font-bold text-gray-700">Jogos & Quiz</span>
            </button>
        </div>

      </div>
      </div>
    </div>
  );
};

export default Dashboard;
