
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import DoramaList from './components/DoramaList';
import SupportChat from './components/SupportChat';
import CheckoutModal from './components/CheckoutModal';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import NameModal from './components/NameModal';
import GamesHub from './components/GamesHub';
import Toast from './components/Toast';
import { User, Dorama } from './types';
import { addDoramaToDB, updateDoramaInDB, removeDoramaFromDB, getUserDoramasFromDB, saveGameProgress, syncDoramaBackup, addLocalDorama, refreshUserProfile, updateLastActive, supabase } from './services/clientService';
import { Heart, X, CheckCircle2, MessageCircle, AlertTriangle, Gift, Gamepad2, Sparkles, Home, Tv2, Palette, RefreshCw, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'watching' | 'favorites' | 'games' | 'completed'>('home');
  const [isTestSession, setIsTestSession] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // UI State Lifted to App Level for Global Header
  const [showPalette, setShowPalette] = useState(false);

  // Feature States
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'renewal' | 'gift' | 'new_sub' | 'early_renewal'>('renewal');
  const [checkoutTargetService, setCheckoutTargetService] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Modal State - Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'watching' | 'favorites' | 'completed'>('watching');
  const [editingDorama, setEditingDorama] = useState<Dorama | null>(null); // State for editing
  
  const [newDoramaName, setNewDoramaName] = useState('');
  const [newDoramaSeason, setNewDoramaSeason] = useState('1');
  const [newDoramaTotalEp, setNewDoramaTotalEp] = useState('16');
  const [newDoramaRating, setNewDoramaRating] = useState(5); // 1-5 Hearts
  
  // Modal State - DELETE
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [doramaToDelete, setDoramaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Name Modal State
  const [showNameModal, setShowNameModal] = useState(false);

  // Auto Login Effect (User & Admin)
  useEffect(() => {
    // Check User Session
    const savedSession = localStorage.getItem('eudorama_session');
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        if (user && user.phoneNumber) {
          // IMMEDIATE RESYNC: Fetch fresh data from DB on load to fix "missing data" on reload
          getUserDoramasFromDB(user.phoneNumber).then(doramas => {
             const updatedUser = {
               ...user,
               watching: doramas.watching,
               favorites: doramas.favorites,
               completed: doramas.completed
             };
             // Always update session with verified DB data (even if empty, to sync deletions)
             handleLogin(updatedUser, true);
          });
        }
      } catch (e) {
        localStorage.removeItem('eudorama_session');
      }
    }

    // Check Admin Session
    const adminSession = localStorage.getItem('eudorama_admin_session');
    if (adminSession === 'true') {
        setIsAdminMode(true);
        setIsAdminLoggedIn(true);
    }
  }, []);

  // AUTO-BACKUP EFFECT: Sync lists to clients table whenever they change
  useEffect(() => {
      if (currentUser && !isTestSession && !isAdminMode) {
          syncDoramaBackup(currentUser.phoneNumber, {
              watching: currentUser.watching,
              favorites: currentUser.favorites,
              completed: currentUser.completed
          });
      }
  }, [currentUser?.watching, currentUser?.favorites, currentUser?.completed]);

  // --- REALTIME & FOCUS REFRESH LOGIC ---
  useEffect(() => {
      if (!currentUser || isTestSession || isAdminMode) return;

      // 1. Initial Update
      updateLastActive(currentUser.phoneNumber);

      // 2. Heartbeat (A cada 2 minutos se a aba estiver visível)
      const heartbeatInterval = setInterval(() => {
          if (document.visibilityState === 'visible') {
              console.log("💓 Heartbeat: Updating online status...");
              updateLastActive(currentUser.phoneNumber);
          }
      }, 2 * 60 * 1000); // 2 minutos

      // 3. Focus Listener
      const onFocus = () => {
          console.log("👀 App em foco: Verificando atualizações e status online...");
          handleRefreshSession(true); // True = silencioso
          updateLastActive(currentUser.phoneNumber);
      };

      window.addEventListener('focus', onFocus);
      window.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') onFocus();
      });

      // 4. SUPABASE REALTIME SUBSCRIPTION FOR DATA
      const channel = supabase
          .channel(`user-updates-${currentUser.id}`)
          .on(
              'postgres_changes',
              {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'clients',
                  filter: `id=eq.${currentUser.id}`,
              },
              async (payload) => {
                  console.log('🔄 REALTIME: Atualização recebida do banco:', payload);
                  const phoneToRefresh = payload.new.phone_number || currentUser.phoneNumber;
                  const { user } = await refreshUserProfile(phoneToRefresh);
                  
                  if (user) {
                      setCurrentUser(prevUser => {
                          if (!prevUser) return user;
                          const mergedUser = {
                              ...user,
                              watching: prevUser.watching,
                              favorites: prevUser.favorites,
                              completed: prevUser.completed,
                          };
                          localStorage.setItem('eudorama_session', JSON.stringify(mergedUser));
                          return mergedUser;
                      });
                      setToast({ message: 'Sua assinatura foi atualizada! 🚀', type: 'success' });
                  }
              }
          )
          .subscribe();

      return () => {
          clearInterval(heartbeatInterval);
          supabase.removeChannel(channel);
          window.removeEventListener('focus', onFocus);
      };
  }, [currentUser?.id, currentUser?.phoneNumber, isTestSession, isAdminMode]);

  // 1-Hour Session Timer for Test Users
  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (isTestSession && currentUser) {
          timer = setTimeout(() => {
              alert('Sessão de teste expirada (1 hora).');
              handleLogout();
          }, 60 * 60 * 1000); // 1 hour
      }
      return () => clearTimeout(timer);
  }, [isTestSession, currentUser]);

  // Check for Name on Login
  useEffect(() => {
      if (currentUser && !isTestSession) {
          // If name is "Dorameira" (default) or empty, show modal
          if (currentUser.name === 'Dorameira' || !currentUser.name) {
              setShowNameModal(true);
          }
      }
  }, [currentUser, isTestSession]);

  const handleLogin = (user: User, remember: boolean = false, isTest: boolean = false) => {
    setCurrentUser(user);
    setIsTestSession(isTest);
    
    if (!isTest) {
      localStorage.setItem('eudorama_session', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
    setIsTestSession(false);
    localStorage.removeItem('eudorama_session');
  };

  // --- REFRESH DATA HANDLER ---
  const handleRefreshSession = async (silent: boolean = false) => {
      if (!currentUser) return;
      
      if (!silent) setIsRefreshing(true);
      
      const { user, error } = await refreshUserProfile(currentUser.phoneNumber);
      
      if (user) {
          // Preserve local app state (doramas) while updating subscription data
          const updatedUser = {
              ...user,
              watching: currentUser.watching,
              favorites: currentUser.favorites,
              completed: currentUser.completed,
              // Update personalized settings if they came from DB
              themeColor: user.themeColor || currentUser.themeColor,
              backgroundImage: user.backgroundImage || currentUser.backgroundImage,
              profileImage: user.profileImage || currentUser.profileImage
          };
          
          handleLogin(updatedUser, true, isTestSession);
          if (!silent) setToast({ message: 'Dados sincronizados com sucesso!', type: 'success' });
      } else {
          if (!silent) setToast({ message: error || 'Erro ao sincronizar.', type: 'error' });
      }
      if (!silent) setIsRefreshing(false);
  };

  const handleNameSaved = (newName: string) => {
      if (currentUser) {
          const updatedUser = { ...currentUser, name: newName };
          setCurrentUser(updatedUser);
          localStorage.setItem('eudorama_session', JSON.stringify(updatedUser));
      }
      setShowNameModal(false);
  };

  // --- ADMIN HANDLERS ---
  const handleAdminClick = () => {
    setIsAdminMode(true);
  };

  const handleAdminSuccess = (remember: boolean) => {
    setIsAdminLoggedIn(true);
    if (remember) {
        localStorage.setItem('eudorama_admin_session', 'true');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsAdminMode(false);
    localStorage.removeItem('eudorama_admin_session');
  };

  // --- PIX HANDLER ---
  const handleOpenCheckout = (type: 'renewal' | 'gift' | 'new_sub' | 'early_renewal', targetService?: string) => {
    setCheckoutType(type);
    setCheckoutTargetService(targetService || null);
    setIsCheckoutOpen(true);
  };

  // --- DORAMA ACTIONS ---
  
  const handleUpdateDorama = async (updatedDorama: Dorama) => {
    if (!currentUser) return;
    
    // Optimistic Update
    const listKey = activeTab === 'favorites' ? 'favorites' : (activeTab === 'completed' ? 'completed' : 'watching');
    
    if (activeTab === 'games' || activeTab === 'home') return; 

    const newList = currentUser[listKey as 'watching' | 'favorites' | 'completed'].map(d => d.id === updatedDorama.id ? updatedDorama : d);
    
    const newUserState = { ...currentUser, [listKey]: newList };
    setCurrentUser(newUserState);
    localStorage.setItem('eudorama_session', JSON.stringify(newUserState));

    // CRITICAL: Force update local backup cache immediately to allow self-healing on reload
    addLocalDorama(currentUser.phoneNumber, listKey as any, updatedDorama);

    // DB Call with Confirmation
    const success = await updateDoramaInDB(updatedDorama);
    if (success) {
        setToast({ message: 'Salvo com sucesso!', type: 'success' });
    } else {
        setToast({ message: 'Erro ao salvar. Verifique a conexão.', type: 'error' });
    }
  };

  const onRequestDeleteDorama = (doramaId: string) => {
    setDoramaToDelete(doramaId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !doramaToDelete) return;
    
    setIsDeleting(true);
    
    // Optimistic Update
    const prevUser = { ...currentUser };
    const listKey = activeTab === 'favorites' ? 'favorites' : (activeTab === 'completed' ? 'completed' : 'watching');

    const newList = currentUser[listKey as 'watching' | 'favorites' | 'completed'].filter(d => d.id !== doramaToDelete);
    
    const newUserState = { ...currentUser, [listKey]: newList };
    setCurrentUser(newUserState);
    localStorage.setItem('eudorama_session', JSON.stringify(newUserState));

    // DB Call
    const success = await removeDoramaFromDB(doramaToDelete);
    
    setIsDeleting(false);
    setIsDeleteModalOpen(false);
    setDoramaToDelete(null);

    if (success) {
        setToast({ message: 'Dorama removido!', type: 'success' });
    } else {
        setToast({ message: 'Erro ao remover.', type: 'error' });
    }
  };

  // --- GAME ACTIONS ---
  const handleSaveGame = async (gameId: string, data: any) => {
      if (!currentUser) return;

      // 1. Update Local State & Storage
      const newProgress = { ...currentUser.gameProgress, [gameId]: data };
      const updatedUser = { ...currentUser, gameProgress: newProgress };
      setCurrentUser(updatedUser);
      localStorage.setItem('eudorama_session', JSON.stringify(updatedUser));

      // 2. Save to Supabase
      await saveGameProgress(currentUser.phoneNumber, gameId, data);
  };

  // --- CONTENT RENDERING ---

  if (isAdminMode) {
    if (isAdminLoggedIn) {
      return <AdminPanel onLogout={handleAdminLogout} />;
    }
    return <AdminLogin onSuccess={handleAdminSuccess} onBack={() => setIsAdminMode(false)} />;
  }

  if (!currentUser) {
    return <Login 
              onLogin={handleLogin} 
              onAdminClick={handleAdminClick} 
              onAdminLoginSuccess={(rem) => { setIsAdminMode(true); handleAdminSuccess(rem); }} 
           />;
  }

  const openAddModal = (type: 'watching' | 'favorites' | 'completed') => {
    setModalType(type);
    setEditingDorama(null); // Clear editing state
    setNewDoramaName('');
    setNewDoramaSeason('1');
    setNewDoramaTotalEp('16');
    setNewDoramaRating(5);
    setIsModalOpen(true);
  };

  const openEditModal = (dorama: Dorama) => {
    // Determine type based on active tab
    if (activeTab === 'games' || activeTab === 'home') return;
    
    setModalType(activeTab); 
    setEditingDorama(dorama);
    setNewDoramaName(dorama.title);
    setNewDoramaSeason(dorama.season ? dorama.season.toString() : '1');
    setNewDoramaTotalEp(dorama.totalEpisodes ? dorama.totalEpisodes.toString() : '16');
    setNewDoramaRating(dorama.rating || 5);
    setIsModalOpen(true);
  };

  const saveDorama = async () => {
    if (!currentUser || !newDoramaName.trim()) return;

    let status: Dorama['status'] = 'Watching';
    if (modalType === 'favorites') status = 'Plan to Watch';
    if (modalType === 'completed') status = 'Completed';

    // Capture values from inputs (Editing OR Creating)
    const season = parseInt(newDoramaSeason) || 1;
    const total = parseInt(newDoramaTotalEp) || 16;
    const rating = newDoramaRating;

    if (editingDorama) {
        // UPDATE MODE
        const updated: Dorama = {
            ...editingDorama,
            title: newDoramaName,
            season: season,
            totalEpisodes: total,
            rating: rating
        };
        
        setIsModalOpen(false);
        await handleUpdateDorama(updated);

    } else {
        // CREATE MODE
        const tempDorama: Dorama = {
          id: 'temp-' + Date.now(), 
          title: newDoramaName,
          genre: 'Drama',
          thumbnail: `https://ui-avatars.com/api/?name=${newDoramaName}&background=random&size=128`,
          status: status,
          episodesWatched: modalType === 'completed' ? total : 1, // Start at Ep 1 if adding to watching
          totalEpisodes: total,
          season: season,
          rating: rating
        };
    
        setIsModalOpen(false);
    
        // Optimistic UI update (shows immediately)
        setCurrentUser(prev => {
            if (!prev) return null;
            const newState = {
              ...prev,
              [modalType]: [...prev[modalType], tempDorama]
            };
            localStorage.setItem('eudorama_session', JSON.stringify(newState));
            return newState;
        });

        // DB Insert
        const createdDorama = await addDoramaToDB(currentUser.phoneNumber, modalType, tempDorama);
    
        if (createdDorama) {
          setToast({ message: 'Adicionado com sucesso!', type: 'success' });
          // Replace temporary item with real DB item (ID fix)
          setCurrentUser(prev => {
            if (!prev) return null;
            const updatedList = prev[modalType].map(d => 
                d.id === tempDorama.id ? createdDorama : d
            );
            const newState = { ...prev, [modalType]: updatedList };
            localStorage.setItem('eudorama_session', JSON.stringify(newState));
            return newState;
          });
        } else {
          setToast({ message: 'Erro ao salvar no banco.', type: 'error' });
        }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard 
                  user={currentUser} 
                  onOpenSupport={() => setIsSupportOpen(true)} 
                  onOpenDoraminha={() => {}} 
                  onOpenCheckout={handleOpenCheckout}
                  onOpenGame={() => setActiveTab('games')}
                  onRefresh={() => handleRefreshSession(false)}
                  isRefreshing={isRefreshing}
                  showPalette={showPalette}
                  setShowPalette={setShowPalette}
               />;
      case 'watching':
        return (
          <DoramaList 
            title="Assistindo Agora" 
            doramas={currentUser.watching} 
            type="watching" 
            onAdd={() => openAddModal('watching')}
            onUpdate={handleUpdateDorama}
            onDelete={onRequestDeleteDorama}
            onEdit={openEditModal}
          />
        );
      case 'favorites':
        return (
          <DoramaList 
            title="Meus Favoritos" 
            doramas={currentUser.favorites} 
            type="favorites" 
            onAdd={() => openAddModal('favorites')}
            onUpdate={handleUpdateDorama}
            onDelete={onRequestDeleteDorama}
            onEdit={openEditModal}
          />
        );
      case 'completed':
          return (
            <DoramaList 
              title="Doramas Finalizados" 
              doramas={currentUser.completed} 
              type="completed" 
              onAdd={() => openAddModal('completed')}
              onUpdate={handleUpdateDorama}
              onDelete={onRequestDeleteDorama}
              onEdit={openEditModal}
            />
          );
      case 'games':
        return <GamesHub user={currentUser} onSaveGame={handleSaveGame} />;
      default:
        return null;
    }
  };

  const getModalTitle = () => {
    if (editingDorama) return 'Editar Dorama';
    switch (modalType) {
      case 'watching': return 'O que está vendo?';
      case 'favorites': return 'Novo Favorito';
      case 'completed': return 'Dorama Finalizado';
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => {
      const isActive = activeTab === id;
      return (
          <button 
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center w-full h-full relative transition-all duration-300 ${isActive ? '-translate-y-2' : ''}`}
          >
              <div className={`p-3 rounded-full transition-all duration-300 shadow-sm ${isActive ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-pink-200 shadow-lg scale-110' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                  <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
              </div>
              {isActive && (
                  <span className="absolute -bottom-4 text-[10px] font-bold text-pink-600 animate-fade-in tracking-tight">
                      {label}
                  </span>
              )}
          </button>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl relative overflow-hidden flex flex-col font-sans">
      {isTestSession && (
         <div className="bg-indigo-600 text-white text-xs text-center py-1 font-bold z-50 sticky top-0">
             MODO TESTE GRÁTIS - SESSÃO ENCERRA EM BREVE
         </div>
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* GLOBAL HEADER - OTIMIZADO */}
      <div className="bg-white/95 backdrop-blur-md p-4 shadow-sm flex justify-between items-center z-30 sticky top-0 border-b border-gray-100 shrink-0">
          <div className="flex flex-col">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1 font-sans">
                  EuDorama <Sparkles className="w-4 h-4 text-pink-500 fill-pink-500" />
              </h1>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest -mt-1 ml-0.5">Clube Exclusivo</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowPalette(!showPalette)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-all border border-gray-200 active:scale-95"
            >
                <Palette className="w-4 h-4" /> <span className="hidden sm:inline">Tema</span>
            </button>
            <button 
                onClick={() => handleRefreshSession(false)}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-all border border-gray-200 disabled:opacity-50 active:scale-95"
            >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Dados</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all border border-red-100 active:scale-95"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

      <main className={`flex-1 relative overflow-hidden pb-28`}>
           <div className="h-full overflow-y-auto scrollbar-hide">{renderContent()}</div>
      </main>

      {/* SUPPORT CHAT OVERLAY (FULL SCREEN) - FIXED POSITION */}
      {isSupportOpen && (
          <div className="fixed inset-0 z-[60] bg-white animate-slide-up">
              <SupportChat 
                  user={currentUser} 
                  onClose={() => setIsSupportOpen(false)} 
              />
          </div>
      )}

      {/* NAME MODAL (Forced) */}
      {showNameModal && (
          <NameModal user={currentUser} onNameSaved={handleNameSaved} />
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <CheckoutModal 
            onClose={() => setIsCheckoutOpen(false)} 
            user={currentUser}
            type={checkoutType}
            targetService={checkoutTargetService || undefined}
        />
      )}

      {/* FLOATING ACTION BUTTONS */}
      {!isSupportOpen && !isCheckoutOpen && activeTab !== 'games' && !showNameModal && (
        <div className="fixed bottom-28 right-4 z-40 flex flex-col gap-4 items-center pointer-events-none">
            <div className="pointer-events-auto flex flex-col gap-4 items-end">
                {/* Christmas Box Button */}
                <div className="relative group">
                   <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       Caixinha de Natal
                   </div>
                   <button 
                        onClick={() => handleOpenCheckout('gift')}
                        className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-110 border-4 border-white animate-bounce"
                        title="Contribua com nossa caixinha de natal"
                    >
                        <Gift className="w-7 h-7" />
                    </button>
                </div>

                {/* WhatsApp Support Button */}
                <div className="relative group">
                    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       Suporte Técnico
                    </div>
                    <a 
                        href="https://wa.me/558894875029?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20Cliente%20EuDorama."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-110 border-4 border-white"
                        title="Fale com o Suporte"
                    >
                        <MessageCircle className="w-7 h-7" />
                    </a>
                </div>
            </div>
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {getModalTitle()}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Dorama</label>
                    <input 
                      autoFocus
                      className="w-full bg-white text-gray-900 border-2 border-gray-300 rounded-xl p-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none placeholder-gray-400"
                      placeholder="Digite o nome..."
                      value={newDoramaName}
                      onChange={(e) => setNewDoramaName(e.target.value)}
                    />
                </div>
                
                {(modalType === 'watching' || modalType === 'completed') && editingDorama && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Temporada</label>
                            <input 
                              type="number"
                              className="w-full bg-white text-gray-900 border-2 border-gray-300 rounded-xl p-3 text-base text-center focus:border-primary-500 outline-none"
                              value={newDoramaSeason}
                              onChange={(e) => setNewDoramaSeason(e.target.value)}
                              min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Total Ep.</label>
                            <input 
                              type="number"
                              className="w-full bg-white text-gray-900 border-2 border-gray-300 rounded-xl p-3 text-base text-center focus:border-primary-500 outline-none"
                              value={newDoramaTotalEp}
                              onChange={(e) => setNewDoramaTotalEp(e.target.value)}
                              min="1"
                              max="999"
                            />
                        </div>
                    </div>
                )}

                {modalType === 'favorites' && (
                    <div className="text-center">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Sua Avaliação (Corações)</label>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setNewDoramaRating(star)}
                                    className="p-1 focus:outline-none transform hover:scale-110 transition-transform"
                                >
                                    <Heart 
                                        className={`w-8 h-8 ${star <= newDoramaRating ? 'text-red-500 fill-red-500' : 'text-gray-300'}`} 
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <button 
                  onClick={saveDorama}
                  className="w-full bg-primary-600 text-white font-bold text-base py-3.5 rounded-xl hover:bg-primary-700 transition-colors shadow-lg mt-2"
                >
                  {editingDorama ? 'Salvar Alterações' : 'Salvar Novo'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-bounce-in border-t-8 border-red-500">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-red-100 p-4 rounded-full">
                 <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              
              <h3 className="text-xl font-extrabold text-gray-900">
                Tem certeza?
              </h3>
              <p className="text-gray-600 text-sm">
                Isso apagará este dorama e todo o seu progresso da lista. <br/>
                <span className="font-bold text-red-600">Essa ação não pode ser desfeita.</span>
              </p>

              <div className="flex gap-3 w-full pt-2">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors flex justify-center items-center shadow-lg text-sm"
                >
                  {isDeleting ? "Excluindo..." : "Sim, Excluir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM NAV (REDESIGNED) */}
      <div className="fixed bottom-6 inset-x-0 z-40 px-4 flex justify-center pointer-events-none">
          <nav className="bg-white/90 backdrop-blur-lg border border-white/50 rounded-[2rem] shadow-2xl p-2 flex justify-between items-center w-full max-w-sm pointer-events-auto ring-1 ring-black/5">
              <NavItem id="home" icon={Home} label="Início" />
              <NavItem id="watching" icon={Tv2} label="Vendo" />
              <NavItem id="games" icon={Gamepad2} label="Jogos" />
              <NavItem id="favorites" icon={Heart} label="Amei" />
              <NavItem id="completed" icon={CheckCircle2} label="Fim" />
          </nav>
      </div>

    </div>
  );
};

export default App;
