
import { createClient } from '@supabase/supabase-js';
import { User, ClientDBRow, Dorama, AdminUserDBRow, SubscriptionDetail } from '../types';
import { MOCK_DB_CLIENTS } from '../constants';

// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://srsqipevsammsfzyaewn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyc3FpcGV2c2FtbXNmenlhZXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMTA0NTQsImV4cCI6MjA4MDU4NjQ1NH0.8ePfpnSVeluDG-YwvrjWiIhl6fr5p6UDoZKjF7rrL1I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- GERENCIAMENTO DE DADOS LOCAIS ---
const getLocalUserData = (phoneNumber: string) => {
  try {
    const data = localStorage.getItem(`dorama_user_${phoneNumber}`);
    return data ? JSON.parse(data) : { watching: [], favorites: [], completed: [] };
  } catch (e) {
    return { watching: [], favorites: [], completed: [] };
  }
};

export const addLocalDorama = (phoneNumber: string, type: 'watching' | 'favorites' | 'completed', dorama: Dorama) => {
  const currentData = getLocalUserData(phoneNumber);
  
  if (!currentData[type]) {
    currentData[type] = [];
  }

  // Remove existing if updating
  currentData[type] = currentData[type].filter((d: Dorama) => d.id !== dorama.id);
  currentData[type].push(dorama);
  
  localStorage.setItem(`dorama_user_${phoneNumber}`, JSON.stringify(currentData));
  return currentData;
};

// --- FUNÇÕES DE CLIENTE ---

/**
 * Busca TODOS os clientes (necessário para o algoritmo de distribuição de senhas e painel admin)
 */
export const getAllClients = async (): Promise<ClientDBRow[]> => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('clients')
        .select('*');
      
      if (!error && data) return data as unknown as ClientDBRow[];
    }
    return MOCK_DB_CLIENTS;
  } catch (e) {
    return MOCK_DB_CLIENTS;
  }
};

export const getTestUser = async (): Promise<{ user: User | null, error: string | null }> => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('phone_number', '00000000000');
        
        if (!data || data.length === 0) return { user: null, error: 'Usuário de teste não configurado.' };
        
        return processUserLogin(data as unknown as ClientDBRow[]);
    } catch (e) {
        return { user: null, error: 'Erro de conexão.' };
    }
};

/**
 * Verifica se o usuário existe e se já tem senha configurada.
 * Retorna também dados básicos de perfil para a UI de Login.
 */
export const checkUserStatus = async (lastFourDigits: string): Promise<{ 
  exists: boolean; 
  hasPassword: boolean; 
  phoneMatches: string[];
  profile?: { name?: string; photo?: string; }
}> => {
  try {
    if (!supabase) return { exists: false, hasPassword: false, phoneMatches: [] };

    const { data, error } = await supabase
      .from('clients')
      .select('phone_number, client_password, client_name, profile_image, deleted')
      .like('phone_number', `%${lastFourDigits}`);

    if (error || !data || data.length === 0) {
      // Fallback Mock
      const foundMock = MOCK_DB_CLIENTS.filter(c => c.phone_number.endsWith(lastFourDigits));
      if (foundMock.length > 0) {
         if (foundMock[0].deleted) return { exists: false, hasPassword: false, phoneMatches: [] };
         return { exists: true, hasPassword: false, phoneMatches: [foundMock[0].phone_number], profile: { name: foundMock[0].client_name } };
      }
      return { exists: false, hasPassword: false, phoneMatches: [] };
    }

    // Filtra usuários excluídos
    const activeClients = (data as any[]).filter(c => !c.deleted);

    if (activeClients.length === 0) {
       return { exists: false, hasPassword: false, phoneMatches: [] };
    }

    // Lógica de Senha Global (Self-Healing) e Perfil
    const hasPass = activeClients.some(row => row.client_password && row.client_password.trim() !== '');
    const phones = Array.from(new Set(activeClients.map(d => d.phone_number as string)));
    
    // Pega o perfil do registro mais completo (que tem foto ou nome)
    const profileRecord = activeClients.find(r => r.profile_image && r.client_name) || 
                          activeClients.find(r => r.client_name) || 
                          activeClients[0];

    const profile = {
        name: profileRecord?.client_name,
        photo: profileRecord?.profile_image
    };

    return { exists: true, hasPassword: hasPass, phoneMatches: phones, profile };

  } catch (e) {
    console.error(e);
    return { exists: false, hasPassword: false, phoneMatches: [] };
  }
};

/**
 * Registra a senha para todos os registros vinculados a aquele número de telefone
 */
export const registerClientPassword = async (phoneNumber: string, password: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .update({ client_password: password })
      .eq('phone_number', phoneNumber)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return false;
    }

    return true;
  } catch (e) {
    console.error('Erro ao salvar senha', e);
    return false;
  }
};

/**
 * Tenta fazer login validando a senha
 * ATUALIZADO: Procura a senha em QUALQUER registro do usuário, não apenas no primeiro.
 */
export const loginWithPassword = async (phoneNumber: string, password: string): Promise<{ user: User | null, error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('phone_number', phoneNumber);

    if (error || !data || data.length === 0) {
      return { user: null, error: 'Usuário não encontrado.' };
    }

    const allRecords = data as unknown as ClientDBRow[];
    
    // Verifica se todos foram deletados
    const activeRecords = allRecords.filter(r => !r.deleted);
    if (activeRecords.length === 0) {
      return { user: null, error: 'Acesso revogado. Entre em contato com o suporte.' };
    }

    // LÓGICA DE SENHA PARA USUÁRIO DE TESTE (Híbrida: Manual ou Automática)
    if (phoneNumber === '00000000000') {
        const autoPass = getRotationalTestPassword();
        const dbPassRecord = allRecords.find(r => r.client_password && r.client_password.trim() !== '');
        const dbPass = dbPassRecord ? dbPassRecord.client_password : '';
        const inputPass = String(password).trim().toUpperCase();

        if ((dbPass && String(password).trim() === dbPass) || (inputPass === autoPass)) {
             return processUserLogin(allRecords);
        }
        return { user: null, error: 'Senha de teste incorreta.' };
    }

    // --- LÓGICA DE LOGIN COM CORREÇÃO DE INCONSISTÊNCIA ---
    
    // 1. Encontra a senha "Mestra" (A senha que existe em qualquer um dos registros)
    const masterRecord = allRecords.find(r => r.client_password && r.client_password.trim() !== '');
    const correctPassword = masterRecord ? masterRecord.client_password : null;

    // 2. Valida a senha digitada
    if (!correctPassword || String(correctPassword).trim() !== String(password).trim()) {
        // Se a senha estiver errada OU se o usuário nunca definiu senha em nenhum registro
        return { user: null, error: 'Senha incorreta.' };
    }

    // 3. AUTO-CORREÇÃO (Backfill): Se a senha está correta, verifique se existem registros SEM senha
    // Isso resolve o problema de compras novas (sem senha) coexistindo com antigas (com senha)
    const recordsMissingPassword = allRecords.filter(r => !r.client_password || r.client_password.trim() === '');
    
    if (recordsMissingPassword.length > 0) {
        console.log(`[Auto-Fix] Aplicando senha encontrada a ${recordsMissingPassword.length} registros antigos/novos sem senha.`);
        // Executa em "background" sem travar o login do usuário
        const idsToUpdate = recordsMissingPassword.map(r => r.id);
        supabase
            .from('clients')
            .update({ client_password: correctPassword })
            .in('id', idsToUpdate)
            .then(({ error }) => {
                if (error) console.error("Erro ao auto-corrigir senhas:", error);
            });
    }

    return processUserLogin(allRecords);

  } catch (e) {
    console.error('Erro login:', e);
    return { user: null, error: 'Erro de conexão. Verifique sua internet.' };
  }
};

/**
 * REFRESH USER PROFILE (Atualizar Dados)
 * Recarrega os dados do usuário, aplicando correções de senha se necessário, sem exigir login.
 */
export const refreshUserProfile = async (phoneNumber: string): Promise<{ user: User | null, error: string | null }> => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('phone_number', phoneNumber);

        if (error || !data || data.length === 0) {
            return { user: null, error: 'Erro ao sincronizar. Verifique a conexão.' };
        }

        const allRecords = data as unknown as ClientDBRow[];
        
        // --- APLICAR CORREÇÃO DE SENHA (SELF-HEALING) NO REFRESH TAMBÉM ---
        const masterRecord = allRecords.find(r => r.client_password && r.client_password.trim() !== '');
        const correctPassword = masterRecord ? masterRecord.client_password : null;

        if (correctPassword) {
            const recordsMissingPassword = allRecords.filter(r => !r.client_password || r.client_password.trim() === '');
            if (recordsMissingPassword.length > 0) {
                console.log(`[Auto-Fix Refresh] Sincronizando ${recordsMissingPassword.length} registros.`);
                const idsToUpdate = recordsMissingPassword.map(r => r.id);
                // Atualiza e não espera para retornar a UI mais rápido (Optimistic)
                supabase.from('clients').update({ client_password: correctPassword }).in('id', idsToUpdate);
            }
        }

        return processUserLogin(allRecords);
    } catch (e) {
        return { user: null, error: 'Erro de conexão.' };
    }
};

// Auxiliar para processar os dados brutos e retornar o objeto User
export const processUserLogin = (userRows: ClientDBRow[]): { user: User | null, error: string | null } => {
    if (userRows.length === 0) return { user: null, error: 'Dados vazios.' };

    const primaryPhone = userRows[0].phone_number;
    const allServices = new Set<string>();
    const subscriptionMap: Record<string, SubscriptionDetail> = {};
    let bestRow = userRows[0];
    let maxExpiryTime = 0;
    let isDebtorAny = false;
    let overrideAny = false;
    let clientName = userRows[0].client_name || "Dorameira";

    // Verificar se a melhor conta (mais recente) está deletada
    const hasActiveAccount = userRows.some(row => !row.deleted);
    if (!hasActiveAccount) {
        return { user: null, error: 'Sua conta foi desativada.' };
    }

    userRows.forEach(row => {
      if (row.deleted) return; 

      if (row.client_name) clientName = row.client_name;

      let subs: string[] = [];
      if (Array.isArray(row.subscriptions)) {
        subs = row.subscriptions;
      } else if (typeof row.subscriptions === 'string') {
        const s = row.subscriptions as string;
        if (s.includes('+')) {
           subs = s.split('+').map(i => i.trim().replace(/^"|"$/g, ''));
        } else {
           subs = [s.replace(/^"|"$/g, '')];
        }
      }
      
      subs.forEach(s => {
          if (s) {
              const cleanService = s.split('|')[0].trim();
              allServices.add(cleanService);
              
              subscriptionMap[cleanService] = {
                  purchaseDate: row.purchase_date,
                  durationMonths: row.duration_months,
                  isDebtor: row.is_debtor
              };
          }
      });

      if (row.is_debtor) isDebtorAny = true;
      if (row.override_expiration) overrideAny = true;

      const purchase = new Date(row.purchase_date);
      const expiry = new Date(purchase);
      expiry.setMonth(purchase.getMonth() + row.duration_months);

      if (expiry.getTime() > maxExpiryTime) {
        maxExpiryTime = expiry.getTime();
        bestRow = row;
      }
    });

    const combinedServices = Array.from(allServices);
    const localData = getLocalUserData(primaryPhone);
    const gameProgress = bestRow.game_progress || {};

    const appUser: User = {
      id: bestRow.id,
      name: clientName, 
      phoneNumber: bestRow.phone_number,
      purchaseDate: bestRow.purchase_date, 
      durationMonths: bestRow.duration_months,
      subscriptionDetails: subscriptionMap,
      services: combinedServices,
      isDebtor: isDebtorAny,
      overrideExpiration: overrideAny,
      watching: localData.watching || [],
      favorites: localData.favorites || [],
      completed: localData.completed || [],
      gameProgress: gameProgress,
      themeColor: bestRow.theme_color,
      backgroundImage: bestRow.background_image,
      profileImage: bestRow.profile_image
    };

    return { user: appUser, error: null };
};

export const getUserDoramasFromDB = async (phoneNumber: string): Promise<{ watching: Dorama[], favorites: Dorama[], completed: Dorama[] }> => {
    const localData = getLocalUserData(phoneNumber);
    
    try {
        const { data, error } = await supabase
            .from('user_doramas')
            .select('*')
            .eq('phone_number', phoneNumber);

        if (error) {
            console.error("Erro Supabase ao buscar doramas:", error);
            throw error; // Força cair no catch para usar o fallback
        }

        if (!data || data.length === 0) {
            // Se o banco retornar vazio, mas temos dados locais, assumimos que pode ser falha ou primeira carga
            // Priorizamos dados locais se existirem para evitar zerar a lista do usuário
            if (localData.watching.length > 0 || localData.favorites.length > 0 || localData.completed.length > 0) {
                return localData;
            }
            return { watching: [], favorites: [], completed: [] };
        }

        const watching = data.filter((d: any) => d.list_type === 'watching').map(mapDoramaRow);
        const favorites = data.filter((d: any) => d.list_type === 'favorites').map(mapDoramaRow);
        const completed = data.filter((d: any) => d.list_type === 'completed').map(mapDoramaRow);

        return { watching, favorites, completed };
    } catch (e) {
        // FALLBACK: Em caso de erro de conexão, retorna o cache local para não mostrar tela vazia
        console.warn("Usando backup local de doramas devido a erro de conexão.");
        return localData;
    }
};

const mapDoramaRow = (row: any): Dorama => ({
    id: row.id,
    title: row.title,
    genre: row.genre,
    thumbnail: row.thumbnail,
    status: row.status,
    episodesWatched: row.episodes_watched,
    totalEpisodes: row.total_episodes,
    season: row.season,
    rating: row.rating
});

export const addDoramaToDB = async (phoneNumber: string, listType: string, dorama: Dorama): Promise<Dorama | null> => {
    try {
        // Salva localmente primeiro (Optimistic + Backup)
        addLocalDorama(phoneNumber, listType as any, dorama);

        const { data, error } = await supabase
            .from('user_doramas')
            .insert([{
                phone_number: phoneNumber,
                title: dorama.title,
                genre: dorama.genre,
                thumbnail: dorama.thumbnail,
                status: dorama.status,
                episodes_watched: dorama.episodesWatched,
                total_episodes: dorama.totalEpisodes,
                season: dorama.season,
                rating: dorama.rating,
                list_type: listType
            }])
            .select()
            .single();

        if (error || !data) return dorama; // Retorna o objeto original se DB falhar, para manter na UI
        return mapDoramaRow(data);
    } catch (e) {
        return dorama; // Fallback
    }
};

export const updateDoramaInDB = async (dorama: Dorama): Promise<boolean> => {
    try {
        if (dorama.id.startsWith('temp-')) return true; // Ignora temps no DB
        
        const { error } = await supabase
            .from('user_doramas')
            .update({
                episodes_watched: dorama.episodesWatched,
                season: dorama.season,
                rating: dorama.rating,
                title: dorama.title,
                total_episodes: dorama.totalEpisodes
            })
            .eq('id', dorama.id);

        return !error;
    } catch (e) {
        return false;
    }
};

export const removeDoramaFromDB = async (doramaId: string): Promise<boolean> => {
    try {
        if (doramaId.startsWith('temp-')) return true;
        const { error } = await supabase.from('user_doramas').delete().eq('id', doramaId);
        return !error;
    } catch (e) {
        return false;
    }
};

export const saveGameProgress = async (phoneNumber: string, gameId: string, progressData: any) => {
    try {
        const { data: clientData } = await supabase
            .from('clients')
            .select('game_progress')
            .eq('phone_number', phoneNumber)
            .limit(1)
            .single();
            
        const currentProgress = clientData?.game_progress || {};
        const newProgress = { ...currentProgress, [gameId]: progressData };

        await supabase
            .from('clients')
            .update({ game_progress: newProgress })
            .eq('phone_number', phoneNumber);
    } catch (e) {
        console.error('Error saving game', e);
    }
};

export const updateClientName = async (phoneNumber: string, newName: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('clients')
            .update({ client_name: newName })
            .eq('phone_number', phoneNumber);
        return !error;
    } catch (e) {
        return true; // Assume sucesso local se DB falhar
    }
};

export const updateClientPreferences = async (phoneNumber: string, preferences: { themeColor?: string, backgroundImage?: string, profileImage?: string }): Promise<boolean> => {
    try {
        const updatePayload: any = {};
        if (preferences.themeColor !== undefined) updatePayload.theme_color = preferences.themeColor;
        if (preferences.backgroundImage !== undefined) updatePayload.background_image = preferences.backgroundImage;
        if (preferences.profileImage !== undefined) updatePayload.profile_image = preferences.profileImage;

        if (Object.keys(updatePayload).length === 0) return true;

        const { error } = await supabase
            .from('clients')
            .update(updatePayload)
            .eq('phone_number', phoneNumber);
            
        return !error;
    } catch (e) {
        return false;
    }
};

export const getSystemConfig = async () => {
    try {
        const { data } = await supabase
            .from('app_credentials')
            .select('*')
            .eq('service', 'SYSTEM_CONFIG')
            .single();
            
        if (data && data.password) {
            return JSON.parse(data.password);
        }
        return null;
    } catch (e) {
        return null;
    }
};

export interface SystemConfig {
    bannerText: string;
    bannerType: 'info' | 'warning' | 'error' | 'success';
    bannerActive: boolean;
    serviceStatus: Record<string, 'ok' | 'issues' | 'down'>;
}

export const saveSystemConfig = async (config: SystemConfig): Promise<boolean> => {
    try {
        const configString = JSON.stringify(config);
        
        const { data } = await supabase.from('app_credentials').select('id').eq('service', 'SYSTEM_CONFIG');
        
        if (data && data.length > 0) {
            await supabase.from('app_credentials')
                .update({ password: configString })
                .eq('service', 'SYSTEM_CONFIG');
        } else {
            await supabase.from('app_credentials')
                .insert([{
                    service: 'SYSTEM_CONFIG',
                    email: 'config@system',
                    password: configString,
                    published_at: new Date().toISOString(),
                    is_visible: false
                }]);
        }
        return true;
    } catch (e) {
        return false;
    }
};

// --- BACKUP ROBUSTO PARA LOCALSTORAGE ---
export const syncDoramaBackup = async (phoneNumber: string, data: { watching: Dorama[], favorites: Dorama[], completed: Dorama[] }) => {
    try {
        if (!phoneNumber) return;
        localStorage.setItem(`dorama_user_${phoneNumber}`, JSON.stringify(data));
    } catch (e) {
        console.error("Erro ao salvar backup local:", e);
    }
};

export const saveClientToDB = async (client: Partial<ClientDBRow>): Promise<boolean> => {
  try {
    const payload = { ...client };
    
    if (client.id) {
        const { error } = await supabase
            .from('clients')
            .update(payload)
            .eq('id', client.id);
        return !error;
    } else {
        const { error } = await supabase
            .from('clients')
            .insert([payload]);
        return !error;
    }
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const deleteClientFromDB = async (clientId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('clients')
            .update({ deleted: true })
            .eq('id', clientId);
            
        return !error;
    } catch(e) {
        return false;
    }
};

export const resetAllClientPasswords = async (): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('clients')
            .update({ client_password: '' })
            .neq('id', '00000000-0000-0000-0000-000000000000'); 
            
        return !error;
    } catch(e) {
        return false;
    }
};

export const createDemoClient = async (): Promise<boolean> => {
    try {
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const phone = `99999${randomSuffix}`;
        
        const { error } = await supabase.from('clients').insert([{
            phone_number: phone,
            client_name: 'Conta Demo',
            purchase_date: new Date().toISOString(),
            duration_months: 1, 
            subscriptions: ['Viki Pass', 'Kocowa+'], 
            is_debtor: false,
            deleted: false,
            client_password: '123'
        }]);
        
        return !error;
    } catch (e) {
        return false;
    }
};

export const loginUserByPhone = async (lastFourDigits: string): Promise<{ user: User | null, error: string | null }> => {
  const found = MOCK_DB_CLIENTS.filter(c => c.phone_number.endsWith(lastFourDigits) && !c.deleted);
  if (found.length > 0) return processUserLogin(found);
  return { user: null, error: 'Cliente não encontrado.' };
};

export const verifyAdminLogin = async (login: string, pass: string): Promise<boolean> => {
  // Override para senha mestre solicitada
  if (pass === '1202') return true;

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', login)
      .limit(1);

    if (error || !data || data.length === 0) {
      return false;
    }

    const admin = data[0] as AdminUserDBRow;
    return admin.password === pass;
  } catch (e) {
    console.error('Erro ao verificar admin:', e);
    return false;
  }
};

export const getRotationalTestPassword = (): string => {
    const now = new Date();
    // Use UTC to ensure consistency across timezones for admin/user coordination
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    const hour = now.getUTCHours();
    const block = Math.floor(hour / 3); // Muda a cada 3 horas

    // Seed generation
    const seed = year * 10000 + month * 100 + day * 10 + block;
    
    // LCG parameters for simple deterministic random
    const a = 1664525;
    const c = 1013904223;
    const m = 4294967296;
    let x = seed;
    
    // Warm up
    x = (a * x + c) % m;
    x = (a * x + c) % m;

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let password = "";
    for (let i = 0; i < 4; i++) {
        x = (a * x + c) % m;
        const val = Math.abs(x);
        password += chars.charAt(val % chars.length);
    }
    
    return password;
};
