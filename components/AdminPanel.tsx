
import React, { useState, useEffect } from 'react';
import { AppCredential, ClientDBRow, User } from '../types';
import { fetchCredentials, saveCredential, deleteCredential, getUsersCountForCredential, getClientsAssignedToCredential, getAssignedCredential } from '../services/credentialService';
import { getAllClients, saveClientToDB, deleteClientFromDB, resetAllClientPasswords, verifyAdminLogin, getSystemConfig, saveSystemConfig, SystemConfig, getRotationalTestPassword, processUserLogin, supabase, createDemoClient } from '../services/clientService';
import { Plus, Trash2, Edit2, LogOut, Eye, Users, Save, RefreshCw, Search, AlertTriangle, X, Check, ShieldAlert, TestTube, Unlock, Ban, Calendar, User as UserIcon, Sparkles, Clock, ArrowDownUp, ChevronDown, ChevronUp, Layers, ArrowUpAZ, Loader2, Key, Smartphone, AtSign, UserCheck, UserMinus, Monitor } from 'lucide-react';

interface AdminPanelProps {
  onLogout: () => void;
}

const SERVICES = ['Viki Pass', 'Kocowa+', 'IQIYI', 'WeTV', 'DramaBox'];
const TEST_ALLOWED_SERVICES = ['Viki Pass', 'Kocowa+', 'WeTV'];

const toLocalInput = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toISO = (localString: string) => {
    if (!localString) return new Date().toISOString();
    return new Date(localString).toISOString();
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'clients' | 'search' | 'test' | 'danger'>('credentials');
  
  const [credentials, setCredentials] = useState<AppCredential[]>([]);
  const [counts, setCounts] = useState<{[key: string]: number}>({});
  const [activeCredsCount, setActiveCredsCount] = useState<{[key: string]: number}>({});
  const [clients, setClients] = useState<ClientDBRow[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSortAlpha, setClientSortAlpha] = useState(false); // State for Alphabetical Sort/Group
  
  const [sysConfig, setSysConfig] = useState<SystemConfig>({
      bannerText: '', bannerType: 'info', bannerActive: false, 
      serviceStatus: { 'Viki Pass': 'ok', 'Kocowa+': 'ok', 'IQIYI': 'ok', 'WeTV': 'ok' } 
  });
  
  const [testServices, setTestServices] = useState<string[]>([]);
  const [testUserLoading, setTestUserLoading] = useState(false);
  const [testUserId, setTestUserId] = useState<string | null>(null);
  const [currentTestPass, setCurrentTestPass] = useState('');
  const [manualTestPass, setManualTestPass] = useState('');

  // SEARCH TAB STATE
  const [searchTabQuery, setSearchTabQuery] = useState('');
  const [searchTabResults, setSearchTabResults] = useState<ClientDBRow[]>([]);
  const [selectedSearchClient, setSelectedSearchClient] = useState<User | null>(null);
  const [revealedLogins, setRevealedLogins] = useState<Record<string, {email: string, pass: string}>>({});
  const [searchingLogins, setSearchingLogins] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stats, setStats] = useState({ totalClients: 0, activeClients: 0, totalRevenue: 0, expiringSoon: 0, debtors: 0 });

  const [viewUsersModal, setViewUsersModal] = useState<{open: boolean, users: ClientDBRow[], cred: AppCredential | null}>({open: false, users: [], cred: null});
  const [clientModal, setClientModal] = useState({ open: false, isEdit: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; type: 'credential' | 'client'; id: string | null }>({ open: false, type: 'credential', id: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const [nuclearStep, setNuclearStep] = useState(0); 
  const [nuclearInput, setNuclearInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [nuclearLoading, setNuclearLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  
  // Sorting & Filtering State
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'warning' | 'stable'>('all');

  // Client Grouping State
  const [expandedPhones, setExpandedPhones] = useState<Set<string>>(new Set());

  const [isEditing, setIsEditing] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false); 
  const [editId, setEditId] = useState<string | null>(null);
  const [service, setService] = useState(SERVICES[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credDate, setCredDate] = useState(''); // New state for Date Editing
  const [bulkText, setBulkText] = useState(''); 
  
  // State for Manual Credential Creation inside Client Modal
  const [newManualCreds, setNewManualCreds] = useState<Record<string, {email: string, pass: string}>>({});

  const [clientForm, setClientForm] = useState<Partial<ClientDBRow>>({
      phone_number: '', client_name: '', client_password: '', subscriptions: [], purchase_date: toLocalInput(new Date().toISOString()), duration_months: 1, is_debtor: false, override_expiration: false, manual_credentials: {}
  });

  useEffect(() => {
    loadData();
    setCurrentTestPass(getRotationalTestPassword());
    const interval = setInterval(() => setCurrentTestPass(getRotationalTestPassword()), 60000);
    
    // Realtime básico apenas para manter a lista atualizada com inserções/edições
    const channel = supabase
        .channel('admin-clients-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'clients' },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    setClients(prev => [payload.new as ClientDBRow, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setClients(prev => prev.map(c => c.id === payload.new.id ? payload.new as ClientDBRow : c));
                } else if (payload.eventType === 'DELETE') {
                    setClients(prev => prev.filter(c => c.id !== payload.old.id));
                }
            }
        )
        .subscribe();

    return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
        setLoading(true);

        const [credData, allClients, sysConf] = await Promise.all([
            fetchCredentials(),
            getAllClients(),
            getSystemConfig()
        ]);

        const filteredCreds = credData.filter(c => c.service !== 'SYSTEM_CONFIG');
        setCredentials(filteredCreds);
        setClients(allClients);
        setSysConfig(sysConf);

        // ... stats logic ...
        const activeCount: {[key: string]: number} = {};
        SERVICES.forEach(s => activeCount[s] = 0);
        filteredCreds.forEach(c => {
            if (c.isVisible) {
                const sName = SERVICES.find(s => c.service.includes(s)) || c.service;
                activeCount[sName] = (activeCount[sName] || 0) + 1;
            }
        });
        setActiveCredsCount(activeCount);

        const now = new Date();
        const active = allClients.filter(c => !c.deleted && !c.is_debtor);
        const revenue = active.length * 15; 
        const debtors = allClients.filter(c => !c.deleted && c.is_debtor).length;
        
        let expiringCount = 0;
        active.forEach(c => {
             const purchase = new Date(c.purchase_date);
             const expiry = new Date(purchase);
             expiry.setMonth(purchase.getMonth() + c.duration_months);
             const diffTime = expiry.getTime() - now.getTime();
             const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
             if (daysLeft <= 7 && daysLeft >= 0) expiringCount++;
        });

        setStats({
            totalClients: allClients.filter(c => !c.deleted).length,
            activeClients: active.length,
            totalRevenue: revenue,
            expiringSoon: expiringCount,
            debtors: debtors
        });

        const newCounts: {[key: string]: number} = {};
        for (const cred of filteredCreds) {
            newCounts[cred.id] = await getUsersCountForCredential(cred, allClients);
        }
        setCounts(newCounts);
        
        const testU = allClients.find(c => c.phone_number === '00000000000');
        if (testU) {
            setTestUserId(testU.id);
            setTestServices(Array.isArray(testU.subscriptions) ? testU.subscriptions : []);
            setManualTestPass(testU.client_password || '');
        }

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Determine Date: Use manual input if available, otherwise current time
    let pubDate = credDate ? toISO(credDate) : new Date().toISOString(); 
    
    if (isBulkMode) {
        const lines = bulkText.split('\n');
        for (const line of lines) {
             if (!line.trim()) continue;
             const parts = line.split(/[:|;\s]+/).filter(p => p.trim() !== '');
             if (parts.length >= 2) {
                 await saveCredential({
                     id: '', service, email: parts[0], password: parts[1], publishedAt: new Date().toISOString(), isVisible: true
                 });
             }
        }
    } else {
        const newCred: AppCredential = {
          id: editId || '', service, email, password, publishedAt: pubDate, isVisible: true
        };
        await saveCredential(newCred);
    }
    resetForm();
    await loadData();
  };

  const getDaysActive = (dateString: string) => {
      const createdDate = new Date(dateString);
      const today = new Date();
      const startOfCreated = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = startOfToday.getTime() - startOfCreated.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getDayStatus = (serviceName: string, day: number): 'stable' | 'warning' | 'critical' => {
        const name = serviceName.toLowerCase();
        // VIKI (14 days)
        if (name.includes('viki')) {
            if (day >= 14) return 'critical';
            if (day === 13) return 'warning';
            return 'stable';
        }
        // KOCOWA (30 days approx - Warning at 20)
        if (name.includes('kocowa')) {
            if (day >= 23) return 'critical';
            if (day >= 20) return 'warning';
            return 'stable';
        }
        // IQIYI (30 days)
        if (name.includes('iqiyi')) {
            if (day >= 30) return 'critical';
            if (day === 29) return 'warning';
            return 'stable';
        }
        return 'stable';
  };

  const getDayColorClass = (status: 'stable' | 'warning' | 'critical') => {
      if (status === 'critical') return 'bg-black text-white'; // Black for dead/urgent
      if (status === 'warning') return 'bg-yellow-100 text-yellow-700'; // Yellow for attention
      return 'bg-blue-100 text-blue-700'; // Blue for safe
  };

  // Filtered and Sorted Credentials
  const processedCredentials = credentials
    .filter(cred => {
        if (filterStatus === 'all') return true;
        const days = getDaysActive(cred.publishedAt);
        const status = getDayStatus(cred.service, days);
        return status === filterStatus;
    })
    .sort((a, b) => {
        const dateA = new Date(a.publishedAt).getTime();
        const dateB = new Date(b.publishedAt).getTime();
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const handleEditCredential = (cred: AppCredential) => {
    setIsBulkMode(false);
    setIsEditing(true);
    setEditId(cred.id);
    setService(cred.service);
    setEmail(cred.email);
    setPassword(cred.password);
    setCredDate(toLocalInput(cred.publishedAt));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setIsEditing(false);
    setIsBulkMode(false);
    setEditId(null);
    setEmail('');
    setPassword('');
    setCredDate('');
    setBulkText('');
  };

  const confirmDelete = async () => {
      if (!deleteModal.id) return;
      setIsDeleting(true);
      if (deleteModal.type === 'credential') {
          await deleteCredential(deleteModal.id);
      } else {
          await deleteClientFromDB(deleteModal.id);
      }
      
      // Delay to ensure DB propagates
      await new Promise(r => setTimeout(r, 500));
      await loadData();
      
      setIsDeleting(false);
      setDeleteModal({ open: false, type: 'credential', id: null });
  };

  const handleSaveClient = async () => {
     if (!clientForm.phone_number) return alert('Telefone é obrigatório');
     setLoading(true);
     
     // 1. Process any new "Manual" credentials created on the fly
     const updatedManualCredentials = { ...(clientForm.manual_credentials || {}) };
     
     // Detect which services have "NEW_MANUAL" selected
     for (const [svcName, credData] of Object.entries(newManualCreds)) {
         if (updatedManualCredentials[svcName] === 'NEW_MANUAL') {
             // Create real credential
             const cData = credData as { email: string; pass: string };
             const newCredId = await saveCredential({
                 id: '',
                 service: svcName,
                 email: cData.email,
                 password: cData.pass,
                 publishedAt: new Date().toISOString(),
                 isVisible: true
             });
             
             if (newCredId) {
                 updatedManualCredentials[svcName] = newCredId;
             }
         }
     }

     const payload = { 
         ...clientForm, 
         purchase_date: toISO(clientForm.purchase_date as string),
         manual_credentials: updatedManualCredentials
     };
     
     const success = await saveClientToDB(payload);
     if (success) { 
         setClientModal({ open: false, isEdit: false }); 
         setNewManualCreds({}); // Reset temporary state
         await loadData(); 
     }
     else alert('Erro ao salvar no banco de dados. Tente novamente.');
     setLoading(false);
  };

  const handleQuickToggleOverride = async (client: ClientDBRow) => {
      setLoading(true);
      const success = await saveClientToDB({ id: client.id, override_expiration: !client.override_expiration });
      if (success) await loadData();
      setLoading(false);
  };

  const handleUpdateTestServices = async () => {
      setTestUserLoading(true);
      // If manual password is empty, we don't force a password, allowing the system to use the rotational one
      const payload: Partial<ClientDBRow> = {
          phone_number: '00000000000',
          client_password: manualTestPass, // If empty string, logic uses auto-pass
          subscriptions: testServices, 
          purchase_date: new Date().toISOString(),
          duration_months: 120, 
          is_debtor: false,
          deleted: false
      };
      if (testUserId) payload.id = testUserId;
      const success = await saveClientToDB(payload);
      if (success) { alert('Configuração de teste salva!'); await loadData(); }
      setTestUserLoading(false);
  };

  const handleSaveSystemConfig = async () => {
      setLoading(true);
      const success = await saveSystemConfig(sysConfig);
      if (success) alert("Salvo!"); else alert("Erro.");
      setLoading(false);
  };

  const handleViewUsers = async (cred: AppCredential) => {
      setLoading(true);
      try {
          const assignedUsers = await getClientsAssignedToCredential(cred, clients);
          setViewUsersModal({ open: true, users: assignedUsers, cred: cred });
      } catch (e) {
          alert("Erro ao buscar usuários");
      }
      setLoading(false);
  };

  const handleCreateDemo = async () => {
      setLoading(true);
      const success = await createDemoClient();
      if (success) { alert("Gerado!"); await loadData(); } else alert("Erro.");
      setLoading(false);
  };

  const toggleVisibility = async (cred: AppCredential) => {
    setLoading(true);
    const updated = { ...cred, isVisible: !cred.isVisible };
    await saveCredential(updated);
    await loadData();
  };

  const handleOpenClientModal = (client?: ClientDBRow) => {
    setNewManualCreds({}); // Clear temp state
    if (client) {
      setClientForm({
        id: client.id,
        phone_number: client.phone_number,
        client_name: client.client_name || '',
        client_password: client.client_password || '',
        subscriptions: Array.isArray(client.subscriptions) ? client.subscriptions : [],
        purchase_date: toLocalInput(client.purchase_date),
        duration_months: client.duration_months,
        is_debtor: client.is_debtor,
        override_expiration: client.override_expiration || false,
        manual_credentials: client.manual_credentials || {}
      });
      setClientModal({ open: true, isEdit: true });
    } else {
      setClientForm({ phone_number: '', client_name: '', client_password: '', subscriptions: [], purchase_date: toLocalInput(new Date().toISOString()), duration_months: 1, is_debtor: false, override_expiration: false, manual_credentials: {} });
      setClientModal({ open: true, isEdit: false });
    }
  };

  // Group Clients logic
  const filteredClients = clients.filter(c => !c.deleted && (c.phone_number.includes(clientSearch) || (c.client_name && c.client_name.toLowerCase().includes(clientSearch.toLowerCase())) || (c.client_password && c.client_password.includes(clientSearch))));
  
  const groupedClients = filteredClients.reduce((acc: Record<string, ClientDBRow[]>, client) => {
      if (!acc[client.phone_number]) acc[client.phone_number] = [];
      acc[client.phone_number].push(client);
      return acc;
  }, {});

  // PREPARE LISTS (Default / Named / Unnamed)
  const defaultKeys = Object.keys(groupedClients); // Usually insertion order
  const namedClientsKeys: string[] = [];
  const unnamedClientsKeys: string[] = [];

  defaultKeys.forEach(phone => {
      const clientList = groupedClients[phone];
      const hasName = clientList[0]?.client_name && clientList[0].client_name.trim() !== '';
      if (hasName) namedClientsKeys.push(phone);
      else unnamedClientsKeys.push(phone);
  });

  // Sort named alphabetically
  namedClientsKeys.sort((a, b) => {
      const nameA = groupedClients[b][0].client_name || '';
      const nameB = groupedClients[a][0].client_name || '';
      return nameB.localeCompare(nameA);
  });

  const togglePhoneExpand = (phone: string) => {
      setExpandedPhones(prev => {
          const next = new Set(prev);
          if (next.has(phone)) next.delete(phone);
          else next.add(phone);
          return next;
      });
  };

  const toggleServiceInForm = (svc: string) => {
      const current = clientForm.subscriptions || [];
      const cleanSvc = svc.split('|')[0];
      const existing = current.find(s => s.startsWith(cleanSvc));
      if (existing) setClientForm({ ...clientForm, subscriptions: current.filter(s => s !== existing) });
      else setClientForm({ ...clientForm, subscriptions: [...current, svc] });
  };

  const toggleTestService = (svc: string) => {
      if (testServices.includes(svc)) setTestServices(prev => prev.filter(s => s !== svc));
      else setTestServices(prev => [...prev, svc]);
  };

  const handleNuclearReset = async () => {
      setNuclearLoading(true);
      const isAdmin = await verifyAdminLogin('1252', adminPassInput); 
      if (!isAdmin) { alert("Senha incorreta."); setNuclearLoading(false); return; }
      const success = await resetAllClientPasswords();
      if (success) { alert("Resetado."); setNuclearStep(0); setNuclearInput(''); setAdminPassInput(''); loadData(); } else { alert("Erro."); }
      setNuclearLoading(false);
  };

  // --- SEARCH TAB LOGIC ---
  const handleExecuteSearch = () => {
      if (!searchTabQuery) return;
      setSelectedSearchClient(null); // Reset selection
      setRevealedLogins({});
      
      const matched = clients.filter(c => 
          !c.deleted && c.phone_number.includes(searchTabQuery)
      );
      setSearchTabResults(matched);
  };

  const handleSelectSearchClient = async (dbRow: ClientDBRow) => {
      setSearchingLogins(true);
      const { user } = processUserLogin([dbRow]);
      setSelectedSearchClient(user);
      
      if (user) {
          const newRevealed: Record<string, {email: string, pass: string}> = {};
          for (const service of user.services) {
              const cleanName = service.split('|')[0].trim();
              const { credential } = await getAssignedCredential(user, cleanName, clients);
              if (credential) {
                  newRevealed[cleanName] = { email: credential.email, pass: credential.password };
              } else {
                  newRevealed[cleanName] = { email: 'Não encontrado', pass: '---' };
              }
          }
          setRevealedLogins(newRevealed);
      }
      setSearchingLogins(false);
  };

  // --- HELPER: Credential Selection for Specific User ---
  const handleManualCredChange = (serviceName: string, value: string) => {
      setClientForm(prev => ({
          ...prev,
          manual_credentials: {
              ...(prev.manual_credentials || {}),
              [serviceName]: value // If value is empty string, it removes the override (back to auto)
          }
      }));
  };

  const updateNewManualCredData = (serviceName: string, field: 'email' | 'pass', val: string) => {
      setNewManualCreds(prev => ({
          ...prev,
          [serviceName]: {
              ...(prev[serviceName] || { email: '', pass: '' }),
              [field]: val
          }
      }));
  };

  // --- RENDER HELPER FOR CLIENT CARD ---
  const renderClientCard = (phone: string) => {
      const clientList = groupedClients[phone];
      const displayName = Array.from(new Set(clientList.map(c => c.client_name).filter(Boolean))).join(' / ') || 'Sem Nome';
      const totalApps = clientList.reduce((acc, curr) => acc + (Array.isArray(curr.subscriptions) ? curr.subscriptions.length : 0), 0);
      const isExpanded = expandedPhones.has(phone);
      const anyDebtor = clientList.some(c => c.is_debtor);
      const mainPassword = clientList.find(c => c.client_password)?.client_password || 'Sem senha';

      return (
          <div key={phone} className={`rounded-xl border transition-all overflow-hidden ${anyDebtor ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white shadow-sm'}`}>
              {/* HEADER CARD - Clickable */}
              <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-colors"
                  onClick={() => togglePhoneExpand(phone)}
              >
                  <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full relative ${anyDebtor ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-600'}`}>
                          {anyDebtor ? <AlertTriangle className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                      </div>
                      <div>
                          <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-gray-900 font-mono tracking-tight">{phone}</h4>
                          </div>
                          <p className="text-sm text-gray-500 font-medium">{displayName}</p>
                      </div>
                  </div>

                  <div className="flex items-center gap-6">
                      <div className="hidden md:flex flex-col items-end">
                          <span className="text-xs font-bold uppercase text-gray-400">Total</span>
                          <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                              <Layers className="w-4 h-4" /> {totalApps} Assinatura(s)
                          </span>
                      </div>
                      <div className="hidden md:flex flex-col items-end">
                          <span className="text-xs font-bold uppercase text-gray-400">Senha</span>
                          <span className="text-sm font-mono font-bold text-gray-800">{mainPassword}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
              </div>

              {/* EXPANDED DETAILS */}
              {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-200 p-2 overflow-x-auto">
                      <table className="w-full text-sm text-left min-w-[500px]">
                          <thead className="text-xs text-gray-400 uppercase font-bold">
                              <tr>
                                  <th className="p-3 pl-4">Apps</th>
                                  <th className="p-3">Data Compra</th>
                                  <th className="p-3">Plano</th>
                                  <th className="p-3 text-right">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                              {clientList.map(client => (
                                  <tr key={client.id} className="hover:bg-gray-100/50 transition-colors">
                                      <td className="p-3 pl-4">
                                          <div className="flex flex-wrap gap-1">
                                              {(Array.isArray(client.subscriptions) ? client.subscriptions : []).map(s => (
                                                  <span key={s} className="bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase shadow-sm">
                                                      {s.split('|')[0]}
                                                  </span>
                                              ))}
                                          </div>
                                      </td>
                                      <td className="p-3 font-mono text-gray-600">
                                          {new Date(client.purchase_date).toLocaleDateString('pt-BR')}
                                      </td>
                                      <td className="p-3">
                                          <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                              {client.duration_months} Mês(es)
                                          </span>
                                          {client.is_debtor && <span className="ml-2 text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded">Bloqueado</span>}
                                          {client.override_expiration && <span className="ml-2 text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Liberado</span>}
                                      </td>
                                      <td className="p-3 text-right">
                                          <div className="flex justify-end gap-1">
                                              <button onClick={() => handleQuickToggleOverride(client)} className={`p-1.5 rounded hover:bg-gray-200 ${client.override_expiration ? 'text-yellow-600' : 'text-gray-400'}`} title="Liberar Acesso Vencido"><Unlock className="w-4 h-4" /></button>
                                              <button onClick={() => handleOpenClientModal(client)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600"><Edit2 className="w-4 h-4" /></button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 pb-24 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel Admin</h1>
                <p className="text-gray-500 font-medium">Gestão EuDorama</p>
            </div>
            <button onClick={onLogout} className="flex items-center text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-colors">
                <LogOut className="w-5 h-5 mr-2" /> Sair
            </button>
        </header>

        {/* TABS */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm w-full md:w-auto self-start overflow-x-auto">
             <button onClick={() => setActiveTab('credentials')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'credentials' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Credenciais</button>
             <button onClick={() => setActiveTab('clients')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Clientes</button>
             <button onClick={() => setActiveTab('search')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Pesquisar Logins</button>
             <button onClick={() => setActiveTab('test')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'test' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Teste Grátis</button>
             <button onClick={() => setActiveTab('danger')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'danger' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Danger</button>
        </div>
        
        {/* TAB 1: CREDENTIALS */}
        {activeTab === 'credentials' && (
             <div>
                 {/* Input Form */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-primary-100 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center">{isEditing ? <Edit2 className="w-5 h-5 mr-2 text-primary-600" /> : <Plus className="w-5 h-5 mr-2 text-primary-600" />}{isEditing ? 'Editar Credencial' : 'Adicionar Nova Conta'}</h3>
                        {isEditing && <button onClick={resetForm} className="text-xs text-gray-500 underline">Cancelar Edição</button>}
                    </div>
                    <form onSubmit={handleSaveCredential} className="space-y-4">
                        <div className="flex gap-2 mb-2">
                             <button type="button" onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${!isBulkMode ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-400'}`}>Individual</button>
                             <button type="button" onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${isBulkMode ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-400'}`}>Em Lote (Vários)</button>
                        </div>
                        {!isBulkMode ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="bg-gray-50 border-0 rounded-xl p-3 font-bold text-gray-700 md:col-span-2" value={service} onChange={e => setService(e.target.value)}>{SERVICES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                <input type="email" placeholder="Email da Conta" className="bg-gray-50 border-0 rounded-xl p-3" value={email} onChange={e => setEmail(e.target.value)} />
                                <input type="text" placeholder="Senha" className="bg-gray-50 border-0 rounded-xl p-3" value={password} onChange={e => setPassword(e.target.value)} />
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Data de Criação (Opcional)</label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full bg-gray-50 border-0 rounded-xl p-3 text-gray-600 font-mono text-sm" 
                                        value={credDate} 
                                        onChange={e => setCredDate(e.target.value)} 
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Deixe em branco para usar a data/hora atual.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2"><select className="w-full bg-gray-50 border-0 rounded-xl p-3 font-bold text-gray-700 mb-2" value={service} onChange={e => setService(e.target.value)}>{SERVICES.map(s => <option key={s} value={s}>{s}</option>)}</select><textarea className="w-full h-32 bg-gray-50 border-0 rounded-xl p-3 font-mono text-xs" placeholder={`email1@exemplo.com:senha1\nemail2@exemplo.com senha2`} value={bulkText} onChange={e => setBulkText(e.target.value)} /><p className="text-[10px] text-gray-400">Formato: email:senha (uma por linha)</p></div>
                        )}
                        <button disabled={loading} className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 flex justify-center items-center shadow-lg shadow-primary-200 transition-transform active:scale-95">{loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Salvar Credencial</>}</button>
                    </form>
                 </div>

                 {/* SORTING & SUMMARY */}
                 <div className="flex flex-col md:flex-row gap-4 mb-6">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 flex gap-4 overflow-x-auto flex-1">
                         {SERVICES.map(s => <div key={s} className="flex flex-col items-center min-w-[80px]"><span className="text-[10px] font-bold uppercase text-gray-400">{s.split(' ')[0]}</span><span className="text-xl font-black text-primary-600">{activeCredsCount[s] || 0}</span></div>)}
                     </div>
                     <div className="flex gap-2 flex-wrap">
                         <button onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')} className="px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 bg-white text-gray-700"><ArrowDownUp className="w-4 h-4"/> {sortOrder === 'newest' ? 'Novos' : 'Antigos'}</button>
                         <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-4 py-2 rounded-xl text-xs font-bold border bg-white text-gray-700 outline-none">
                             <option value="all">Todas as Cores</option>
                             <option value="stable">Azul (Estável)</option>
                             <option value="warning">Amarelo (Atenção)</option>
                             <option value="critical">Preto/Vermelho (Crítico)</option>
                         </select>
                     </div>
                 </div>

                 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {processedCredentials.map(cred => {
                         const daysActive = getDaysActive(cred.publishedAt);
                         const status = getDayStatus(cred.service, daysActive);
                         const colorClass = getDayColorClass(status);
                         
                         return (
                             <div key={cred.id} className={`bg-white p-5 rounded-2xl shadow-sm border transition-all ${cred.isVisible ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                                 <div className="flex justify-between items-start mb-3">
                                     <div>
                                         <span className="font-bold text-lg text-gray-800 block">{cred.service}</span>
                                         <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${cred.isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{cred.isVisible ? 'Ativo' : 'Oculto'}</span>
                                         <span className={`inline-block mt-1 ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${colorClass}`}>{daysActive} Dias</span>
                                     </div>
                                     <div className="flex bg-gray-50 rounded-lg p-1"><button onClick={(e) => { e.stopPropagation(); toggleVisibility(cred); }} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all"><Eye className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); handleEditCredential(cred); }} className="p-2 text-blue-500 hover:bg-white rounded-md transition-all"><Edit2 className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); setDeleteModal({open: true, type: 'credential', id: cred.id}); }} className="p-2 text-red-500 hover:bg-white rounded-md transition-all"><Trash2 className="w-4 h-4" /></button></div>
                                 </div>
                                 <div className="space-y-2 bg-gray-50 p-3 rounded-xl mb-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-400 uppercase">Email</span><span className="text-sm font-mono font-bold text-gray-700 truncate max-w-[150px]">{cred.email}</span></div><div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-400 uppercase">Senha</span><span className="text-sm font-mono font-bold text-gray-700">{cred.password}</span></div></div>
                                 <div className="flex justify-between items-center pt-2 border-t border-gray-100"><span className="text-[10px] text-gray-400 font-bold">Criada em: {new Date(cred.publishedAt).toLocaleDateString()}</span><button onClick={() => handleViewUsers(cred)} className="flex items-center gap-1 text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100 transition-colors"><Users className="w-3 h-3" /> {counts[cred.id] || 0} Usuários</button></div>
                             </div>
                         );
                    })}
                 </div>
             </div>
        )}

        {/* TAB 2: CLIENTS (REORGANIZED BY PHONE) */}
        {activeTab === 'clients' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="relative w-full md:w-96"><Search className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" /><input type="text" placeholder="Buscar por nome, telefone ou senha..." className="w-full bg-gray-50 text-gray-900 pl-11 pr-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-primary-500" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} /></div>
                    <div className="flex gap-2">
                        <button onClick={() => setClientSortAlpha(!clientSortAlpha)} className={`px-4 py-3 rounded-xl font-bold flex items-center shadow-sm transition-all active:scale-95 border ${clientSortAlpha ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                            <ArrowUpAZ className="w-5 h-5 mr-2" /> {clientSortAlpha ? 'A-Z' : 'Padrão'}
                        </button>
                        <button onClick={handleCreateDemo} disabled={loading} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-purple-700 shadow-lg shadow-purple-100 transition-transform active:scale-95">{loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Gerar Demo</>}</button>
                        {/* Botão Novo Cliente REMOVIDO conforme solicitado */}
                    </div>
                </div>
                
                <div className="space-y-4">
                    {defaultKeys.length === 0 && <p className="text-center text-gray-400 py-10">Nenhum cliente encontrado.</p>}
                    
                    {clientSortAlpha ? (
                        <>
                            {/* GRUPO: COM NOME */}
                            <div className="flex items-center gap-2 mb-4 mt-2 px-1">
                                <div className="bg-green-100 p-2 rounded-full"><UserCheck className="w-5 h-5 text-green-600" /></div>
                                <h3 className="font-bold text-gray-700 text-lg">Clientes Identificados ({namedClientsKeys.length})</h3>
                            </div>
                            <div className="space-y-4 mb-8">
                                {namedClientsKeys.map(phone => renderClientCard(phone))}
                                {namedClientsKeys.length === 0 && <p className="text-gray-400 text-sm ml-10">Nenhum cliente com nome definido.</p>}
                            </div>

                            {/* GRUPO: SEM NOME */}
                            <div className="flex items-center gap-2 mb-4 mt-8 border-t pt-6 px-1 border-gray-200">
                                <div className="bg-gray-100 p-2 rounded-full"><UserMinus className="w-5 h-5 text-gray-500" /></div>
                                <h3 className="font-bold text-gray-700 text-lg">Sem Nome ({unnamedClientsKeys.length})</h3>
                            </div>
                            <div className="space-y-4">
                                {unnamedClientsKeys.map(phone => renderClientCard(phone))}
                                {unnamedClientsKeys.length === 0 && <p className="text-gray-400 text-sm ml-10">Todos os clientes possuem nome.</p>}
                            </div>
                        </>
                    ) : (
                        // LISTA PADRÃO (Misturada/Inserção)
                        defaultKeys.map(phone => renderClientCard(phone))
                    )}
                </div>
            </div>
        )}

        {/* TAB 3: SEARCH LOGINS (RESTAURADO) */}
        {activeTab === 'search' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div>
                    <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-blue-600"/> Descobrir Login Atual</h3>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-lg font-bold"
                            placeholder="Digite o telefone do cliente..."
                            value={searchTabQuery}
                            onChange={(e) => setSearchTabQuery(e.target.value)}
                        />
                        <button onClick={handleExecuteSearch} className="bg-blue-600 text-white px-8 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                            <Search className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {searchTabResults.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Resultados ({searchTabResults.length})</p>
                        <div className="space-y-2">
                            {searchTabResults.map(res => (
                                <button 
                                    key={res.id} 
                                    onClick={() => handleSelectSearchClient(res)}
                                    className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-all ${selectedSearchClient?.id === res.id ? 'bg-blue-100 border-blue-300 text-blue-900 shadow-sm' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
                                >
                                    <span className="font-mono font-bold">{res.phone_number}</span>
                                    <span className="text-xs opacity-60">{new Date(res.purchase_date).toLocaleDateString()}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {selectedSearchClient && (
                    <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 animate-fade-in-up">
                        <h4 className="font-black text-xl text-blue-900 mb-4 flex items-center gap-2"><Monitor className="w-6 h-6"/> Acessos Ativos</h4>
                        
                        {searchingLogins ? (
                            <div className="flex items-center gap-2 text-blue-600 font-bold"><Loader2 className="w-5 h-5 animate-spin" /> Calculando acessos...</div>
                        ) : (
                            <div className="grid gap-3">
                                {Object.entries(revealedLogins).map(([svc, creds]) => (
                                    <div key={svc} className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col md:flex-row justify-between md:items-center gap-2">
                                        <span className="font-bold text-gray-800 text-lg">{svc}</span>
                                        <div className="flex flex-col md:text-right">
                                            <span className="font-mono text-sm font-bold text-blue-600 select-all">{creds.email}</span>
                                            <span className="font-mono text-xs text-gray-400 select-all">{creds.pass}</span>
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(revealedLogins).length === 0 && <p className="text-gray-500 italic">Nenhum serviço ativo encontrado.</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* TAB 4: TEST USER (RESTAURADO) */}
        {activeTab === 'test' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
                    <h3 className="font-bold text-indigo-900 text-lg mb-2 flex items-center gap-2"><TestTube className="w-6 h-6"/> Configuração de Teste Grátis</h3>
                    <p className="text-indigo-700 text-sm mb-4">O usuário <strong>00000000000</strong> é usado para testes automáticos de 1 hora.</p>
                    
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 flex items-center justify-between mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Senha Rotativa Atual</p>
                            <p className="text-2xl font-mono font-black text-indigo-600 tracking-widest">{currentTestPass}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase">Expira em</p>
                            <p className="text-sm font-bold text-gray-600">~60 min</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-2">Senha Fixa (Opcional - Substitui a rotativa)</label>
                            <input 
                                type="text" 
                                className="w-full bg-white border border-indigo-200 rounded-xl p-3 font-mono text-indigo-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Deixe vazio para usar a rotativa"
                                value={manualTestPass}
                                onChange={e => setManualTestPass(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-2">Serviços Liberados no Teste</label>
                            <div className="flex flex-wrap gap-2">
                                {TEST_ALLOWED_SERVICES.map(svc => (
                                    <button 
                                        key={svc} 
                                        onClick={() => toggleTestService(svc)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${testServices.includes(svc) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}
                                    >
                                        {svc} {testServices.includes(svc) && <Check className="w-3 h-3 inline ml-1" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={handleUpdateTestServices} 
                            disabled={testUserLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex justify-center"
                        >
                            {testUserLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Salvar Configuração de Teste'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* TAB 5: DANGER (RESTAURADO) */}
        {activeTab === 'danger' && (
            <div className="space-y-6">
                {/* SYSTEM CONFIG */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-200">
                    <h3 className="font-bold text-orange-900 text-lg mb-4 flex items-center gap-2"><ShieldAlert className="w-6 h-6"/> Configuração do Sistema</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Texto do Banner (Aviso Geral)</label>
                            <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3" value={sysConfig.bannerText} onChange={e => setSysConfig({...sysConfig, bannerText: e.target.value})} placeholder="Ex: Manutenção programada..." />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Banner</label>
                                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3" value={sysConfig.bannerType} onChange={e => setSysConfig({...sysConfig, bannerType: e.target.value as any})}>
                                    <option value="info">Azul (Info)</option>
                                    <option value="warning">Amarelo (Atenção)</option>
                                    <option value="error">Vermelho (Erro)</option>
                                    <option value="success">Verde (Sucesso)</option>
                                </select>
                            </div>
                            <div className="flex items-end pb-3">
                                <label className="flex items-center cursor-pointer gap-2">
                                    <input type="checkbox" checked={sysConfig.bannerActive} onChange={e => setSysConfig({...sysConfig, bannerActive: e.target.checked})} className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500" />
                                    <span className="font-bold text-gray-700">Ativar Banner</span>
                                </label>
                            </div>
                        </div>
                        <button onClick={handleSaveSystemConfig} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-orange-700 transition-colors shadow-lg shadow-orange-100">Salvar Configuração</button>
                    </div>
                </div>

                {/* NUCLEAR RESET */}
                <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200">
                    <h3 className="font-black text-red-900 text-xl mb-2 flex items-center gap-2"><Ban className="w-6 h-6"/> ZONA DE PERIGO</h3>
                    <p className="text-red-700 mb-6 text-sm">Ações irreversíveis. Cuidado.</p>

                    {nuclearStep === 0 && (
                        <button onClick={() => setNuclearStep(1)} className="bg-red-600 text-white px-6 py-4 rounded-xl font-bold w-full hover:bg-red-700 shadow-lg shadow-red-200 transition-transform active:scale-95">
                            RESETAR TODAS AS SENHAS DE CLIENTES
                        </button>
                    )}

                    {nuclearStep === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="font-bold text-red-800">Tem certeza? Todos os clientes perderão o acesso até criarem nova senha.</p>
                            <input type="text" placeholder='Digite "DELETAR" para confirmar' className="w-full border-2 border-red-300 p-3 rounded-xl bg-white text-red-900 font-bold" value={nuclearInput} onChange={e => setNuclearInput(e.target.value)} />
                            {nuclearInput === 'DELETAR' && (
                                <button onClick={() => setNuclearStep(2)} className="bg-red-900 text-white px-6 py-3 rounded-xl font-bold w-full">Continuar</button>
                            )}
                            <button onClick={() => setNuclearStep(0)} className="text-red-600 underline text-sm w-full text-center">Cancelar</button>
                        </div>
                    )}

                    {nuclearStep === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="font-bold text-red-800">Confirmação Final: Digite sua senha de Admin</p>
                            <input type="password" placeholder='Senha do Admin' className="w-full border-2 border-red-300 p-3 rounded-xl bg-white text-red-900 font-bold" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} />
                            <button onClick={handleNuclearReset} disabled={nuclearLoading} className="bg-black text-white px-6 py-4 rounded-xl font-bold w-full flex justify-center">
                                {nuclearLoading ? <Loader2 className="w-6 h-6 animate-spin"/> : 'EXECUTAR RESET'}
                            </button>
                            <button onClick={() => setNuclearStep(0)} className="text-gray-500 underline text-sm w-full text-center">Cancelar</button>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* ... CLIENT MODAL ... */}
        {clientModal.open && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-fade-in-up max-h-[90vh] overflow-y-auto relative">
                    <button onClick={() => setClientModal({ ...clientModal, open: false })} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
                    <h3 className="text-2xl font-extrabold text-gray-900 mb-6">{clientModal.isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome (Apelido)</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                                    <input type="text" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl pl-10 pr-4 py-3.5 focus:ring-2 focus:ring-primary-500" value={clientForm.client_name} onChange={e => setClientForm({...clientForm, client_name: e.target.value})} placeholder="Ex: Maria Dorameira" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone (Whatsapp)</label>
                                <input type="text" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500 font-mono" value={clientForm.phone_number} onChange={e => setClientForm({...clientForm, phone_number: e.target.value})} placeholder="88999999999" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha Acesso</label>
                                <input type="text" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500 font-mono" value={clientForm.client_password} onChange={e => setClientForm({...clientForm, client_password: e.target.value})} placeholder="1234" />
                            </div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><p className="text-xs text-blue-800 font-bold mb-1">💡 Dica de Mestre:</p><p className="text-xs text-blue-700">Para clientes que compraram assinaturas em <strong>datas diferentes</strong>, digite o nome do app seguido de | e a data (AAAA-MM-DD). Exemplo: <strong>Viki Pass|2025-11-05</strong></p></div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Serviços Contratados</label>
                            <div className="flex flex-wrap gap-2 mb-4">{SERVICES.map(svc => <button key={svc} type="button" onClick={() => toggleServiceInForm(svc)} className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all ${clientForm.subscriptions?.some(s => s.startsWith(svc)) ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{svc} {clientForm.subscriptions?.some(s => s.startsWith(svc)) && <Check className="w-3 h-3 inline ml-1" />}</button>)}</div>
                            
                            {/* CREDENTIAL ASSIGNMENT SECTION */}
                            {(clientForm.subscriptions && clientForm.subscriptions.length > 0) && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-2 space-y-4">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center"><Monitor className="w-3 h-3 mr-1"/> Atribuição de Login (Opcional)</h4>
                                    
                                    {clientForm.subscriptions.map(rawSvc => {
                                        const cleanSvc = rawSvc.split('|')[0];
                                        const currentManual = clientForm.manual_credentials?.[cleanSvc] || '';
                                        
                                        // Filter credentials for this service
                                        const availableCreds = credentials.filter(c => c.service.toLowerCase().includes(cleanSvc.toLowerCase()));

                                        return (
                                            <div key={cleanSvc} className="bg-white border border-gray-200 rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-gray-800 text-sm">{cleanSvc}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{currentManual === 'NEW_MANUAL' ? 'Criando Novo...' : (currentManual ? 'Manual' : 'Automático')}</span>
                                                </div>
                                                
                                                <select 
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-bold text-gray-700 outline-none focus:border-primary-300"
                                                    value={currentManual}
                                                    onChange={(e) => handleManualCredChange(cleanSvc, e.target.value)}
                                                >
                                                    <option value="">⚡ Automático (Recomendado)</option>
                                                    <option value="NEW_MANUAL">➕ Criar Novo Manualmente...</option>
                                                    <optgroup label="Contas Existentes">
                                                        {availableCreds.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.email} (Ativa há {getDaysActive(c.publishedAt)}d)
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                </select>

                                                {/* UI FOR NEW MANUAL ENTRY */}
                                                {currentManual === 'NEW_MANUAL' && (
                                                    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2 animate-fade-in">
                                                        <input 
                                                            type="email" 
                                                            placeholder="Email da Nova Conta" 
                                                            className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs"
                                                            value={((newManualCreds[cleanSvc] as { email: string, pass: string } | undefined) || { email: '', pass: '' }).email}
                                                            onChange={(e) => updateNewManualCredData(cleanSvc, 'email', e.target.value)}
                                                        />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Senha da Nova Conta" 
                                                            className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs"
                                                            value={((newManualCreds[cleanSvc] as { email: string, pass: string } | undefined) || { email: '', pass: '' }).pass}
                                                            onChange={(e) => updateNewManualCredData(cleanSvc, 'pass', e.target.value)}
                                                        />
                                                        <p className="text-[10px] text-orange-500 font-bold">⚠️ Será salva nas credenciais gerais.</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> Data Início (Geral)</label><input type="datetime-local" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 font-mono text-sm" value={clientForm.purchase_date} onChange={e => setClientForm({...clientForm, purchase_date: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> Plano (Duração)</label><select className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500 font-bold" value={clientForm.duration_months} onChange={e => setClientForm({...clientForm, duration_months: parseInt(e.target.value)})}> <option value={1}>1 Mês (Mensal)</option> <option value={2}>2 Meses</option> <option value={3}>3 Meses (Trimestral)</option> <option value={6}>6 Meses (Semestral)</option> <option value={12}>1 Ano (Anual)</option> <option value={999}>Vitalício / Demo</option> </select></div></div>
                        <div className="space-y-3"><div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => setClientForm({...clientForm, is_debtor: !clientForm.is_debtor})}><div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${clientForm.is_debtor ? 'bg-red-600 border-red-600' : 'bg-white border-red-200'}`}> {clientForm.is_debtor && <Check className="w-4 h-4 text-white" />} </div><span className="text-red-900 font-bold text-sm">Cliente Inadimplente (Bloquear Acesso)</span></div><div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100 cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => setClientForm({...clientForm, override_expiration: !clientForm.override_expiration})}><div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${clientForm.override_expiration ? 'bg-yellow-500 border-yellow-500' : 'bg-white border-yellow-200'}`}> {clientForm.override_expiration && <Check className="w-4 h-4 text-white" />} </div><div><span className="text-yellow-900 font-bold text-sm block">Liberar Acesso (Vencido)</span></div></div></div>
                        <button onClick={handleSaveClient} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black flex justify-center items-center shadow-lg mt-2"> {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Salvar no Banco de Dados'} </button>
                    </div>
                </div>
            </div>
        )}

        {/* ... (VIEW USERS AND DELETE MODALS) ... */}
        {viewUsersModal.open && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                        <h3 className="font-bold text-gray-800 text-lg">Usuários nesta Conta</h3>
                        <button onClick={() => setViewUsersModal({open: false, users: [], cred: null})}><X className="w-6 h-6 text-gray-400"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {viewUsersModal.users.length === 0 ? (
                            <p className="text-center text-gray-400 py-10">Nenhum usuário alocado automaticamente.</p>
                        ) : (
                            viewUsersModal.users.map((u, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="font-mono font-bold text-gray-700">{u.phone_number}</span>
                                    {u.client_name && <span className="text-xs text-gray-500">{u.client_name}</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {deleteModal.open && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
                    <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-8 h-8 text-red-600" /></div>
                    <h3 className="font-extrabold text-xl text-gray-900 mb-2">Excluir {deleteModal.type === 'credential' ? 'Credencial' : 'Cliente'}?</h3>
                    <p className="text-gray-500 text-sm mb-6">Essa ação não pode ser desfeita.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setDeleteModal({...deleteModal, open: false})} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
                        <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl flex justify-center items-center">{isDeleting ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Sim, Excluir'}</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
