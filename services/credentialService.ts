
import { AppCredential, AppCredentialDBRow, User, ClientDBRow } from '../types';
import { getAllClients, supabase } from './clientService';
import { MOCK_CREDENTIALS } from '../constants';

// --- CRUD COM SUPABASE ---

export const fetchCredentials = async (): Promise<AppCredential[]> => {
  try {
    const { data, error } = await supabase
      .from('app_credentials')
      .select('*');

    if (error) {
        if (error.message && !error.message.includes('Failed to fetch')) {
             console.error('Supabase error fetching credentials:', JSON.stringify(error, null, 2));
        }
        throw error;
    }

    if (!data) return [];

    return (data as unknown as AppCredentialDBRow[]).map(row => ({
      id: row.id,
      service: row.service || 'Serviço Desconhecido',
      email: row.email || 'Sem Email',
      password: row.password || 'Sem Senha',
      publishedAt: row.published_at || new Date().toISOString(),
      isVisible: row.is_visible !== undefined ? row.is_visible : true
    }));
  } catch (error) {
    console.warn('Usando credenciais de demonstração (Conexão falhou).');
    return MOCK_CREDENTIALS.map(row => ({
      id: row.id,
      service: row.service,
      email: row.email,
      password: row.password,
      publishedAt: row.published_at,
      isVisible: row.is_visible
    }));
  }
};

export const saveCredential = async (cred: AppCredential): Promise<void> => {
  try {
    const dbRow = {
      service: cred.service,
      email: cred.email,
      password: cred.password,
      published_at: cred.publishedAt,
      is_visible: cred.isVisible
    };

    if (cred.id && cred.id.length > 20) {
      const { error } = await supabase
        .from('app_credentials')
        .update(dbRow)
        .eq('id', cred.id);
        if (error) throw error;
    } else {
      const { error } = await supabase
        .from('app_credentials')
        .insert([dbRow]);
        if (error) throw error;
    }
  } catch (error) {
    console.error('Erro ao salvar credencial:', error);
  }
};

export const deleteCredential = async (id: string): Promise<void> => {
  try {
    const response = await supabase.from('app_credentials').delete().eq('id', id);
    if (response.error) {
        throw new Error(`Erro SQL: ${response.error.message}`);
    }
  } catch (error) {
    console.error('Erro ao deletar:', error);
    throw error;
  }
};

// --- LÓGICA DE DISTRIBUIÇÃO E CICLO DE VIDA ---

// OTIMIZAÇÃO: Aceita 'allClients' opcional para evitar chamadas repetidas ao banco
export const getAssignedCredential = async (user: User, serviceName: string, preloadedClients?: ClientDBRow[]): Promise<{ credential: AppCredential | null, alert: string | null, daysActive: number }> => {
  // 1. Busca credenciais do banco
  const credentialsList = await fetchCredentials();
  
  // LOGIC: TEST USER RANDOMIZATION (Somente 3 Apps Permitidos)
  if (user.phoneNumber === '00000000000') {
      const ALLOWED_TEST_APPS = ['Viki Pass', 'Kocowa+', 'WeTV'];
      const isAllowed = ALLOWED_TEST_APPS.some(app => serviceName.toLowerCase().includes(app.toLowerCase()));
      
      if (!isAllowed) {
          return { credential: null, alert: "Este app não está no teste grátis.", daysActive: 0 };
      }

      // Filtra credenciais disponíveis para este serviço
      // FIX: Removida restrição excessiva. Se tiver credencial visível no banco, o teste usa.
      const testPool = credentialsList.filter(c => c.isVisible && c.service.toLowerCase().includes(serviceName.toLowerCase()));
      
      if (testPool.length === 0) {
          // Se não achar nada, tenta buscar qualquer coisa que contenha parte do nome (fallback)
          const fallbackPool = credentialsList.filter(c => c.service.toLowerCase().includes(serviceName.split(' ')[0].toLowerCase()));
          if (fallbackPool.length > 0) {
              const randomFallback = Math.floor(Math.random() * fallbackPool.length);
              return { credential: fallbackPool[randomFallback], alert: "Conta de Teste (Rotativa 1h)", daysActive: 1 };
          }
          return { credential: null, alert: "Sem contas disponíveis no momento.", daysActive: 0 };
      }
      
      // Seleção Aleatória Real
      const randomIndex = Math.floor(Math.random() * testPool.length);
      return { credential: testPool[randomIndex], alert: "Conta de Teste (Rotativa 1h)", daysActive: 1 };
  }

  // --- LÓGICA PARA USUÁRIOS REAIS ---
  const allCreds = credentialsList
    .filter(c => c.isVisible && c.service.toLowerCase().includes(serviceName.toLowerCase()))
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

  if (allCreds.length === 0) return { credential: null, alert: null, daysActive: 0 };

  // 2. Busca clientes e calcula posição (Distribuição)
  // OTIMIZAÇÃO: Usa a lista pré-carregada se existir
  const allClients = preloadedClients || await getAllClients();
  const activeClients = allClients.filter((c: any) => !c.deleted);
  
  const clientsWithService = activeClients.filter(client => {
    let subs: string[] = [];
    if (Array.isArray(client.subscriptions)) {
      subs = client.subscriptions;
    } else if (typeof client.subscriptions === 'string') {
      const s = client.subscriptions as string;
      subs = s.includes('+') ? s.split('+') : [s];
    }
    return subs.some(s => s.toLowerCase().includes(serviceName.toLowerCase()));
  });

  clientsWithService.sort((a, b) => a.phone_number.localeCompare(b.phone_number));

  const userPhoneClean = user.phoneNumber.replace(/\D/g, '');
  const userIndex = clientsWithService.findIndex(c => c.phone_number.replace(/\D/g, '') === userPhoneClean);

  if (userIndex === -1) {
    // Se não achou na lista (ex: Admin logado), mostra a primeira
    const firstCred = allCreds[0];
    return calculateAlerts(firstCred, serviceName);
  }

  // 3. Regras de Capacidade (Quantos users por conta)
  let capacity = 4; // Default Viki/Kocowa
  if (serviceName.toLowerCase().includes('iqiyi')) {
    capacity = allCreds.length > 0 ? Math.ceil(clientsWithService.length / allCreds.length) : 4;
  } else if (serviceName.toLowerCase().includes('wetv')) {
    capacity = 1000; 
  }

  // 4. Seleciona a credencial
  const credentialIndex = Math.floor(userIndex / capacity);
  const assignedCred = allCreds[credentialIndex % allCreds.length];

  return calculateAlerts(assignedCred, serviceName);
};

// FUNÇÃO AUXILIAR DE CÁLCULO DE DIAS (CALENDAR DAYS STRICT)
const calculateAlerts = (cred: AppCredential, serviceName: string) => {
  // 5. CÁLCULO DE DIAS (CALENDAR MODE - UTC BASED)
  // Força o cálculo em UTC para evitar problemas de fuso horário local do navegador
  
  const dateCreated = new Date(cred.publishedAt);
  const today = new Date();

  // Zera as horas para comparar apenas os dias do calendário
  // Usa UTC para consistência total
  const createdUTC = Date.UTC(dateCreated.getFullYear(), dateCreated.getMonth(), dateCreated.getDate());
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  
  // Diferença em ms -> Dias
  const diffTime = todayUTC - createdUTC;
  const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 Para ser inclusivo (Hoje = Dia 1)

  let alertMsg = null;
  const sName = serviceName.toLowerCase();

  // --- REGRAS DE NOTIFICAÇÃO ---
  
  // Viki (Ciclo ~14 dias)
  // Exemplo: Criado 01/11. Hoje 13/11. DaysPassed = 13.
  if (sName.includes('viki')) {
      if (daysPassed >= 14) {
          alertMsg = "⚠️ Conta Expirada (14 Dias). Aguarde nova!";
      } else if (daysPassed === 13) {
          alertMsg = "⚠️ Atenção: Último dia deste login!";
      } else if (daysPassed >= 10) { 
          alertMsg = `⚠️ Ciclo final (${daysPassed}/14 dias). Nova conta em breve.`;
      }
  } 
  // Kocowa (Ciclo ~30 dias)
  else if (sName.includes('kocowa')) {
      if (daysPassed >= 30) {
          alertMsg = "⚠️ Conta Expirada. Aguarde nova!";
      } else if (daysPassed >= 28) {
          alertMsg = "⚠️ Atenção: A senha muda em breve!";
      }
  }
  // IQIYI (Ciclo ~30 dias)
  else if (sName.includes('iqiyi')) {
      if (daysPassed >= 29) {
          alertMsg = "⚠️ Atualização de conta iminente.";
      }
  }
  // Genérico (Segurança para qualquer app esquecido > 35 dias)
  else if (daysPassed >= 35) {
      alertMsg = "⚠️ Login muito antigo. Verifique se funciona.";
  }

  return { credential: cred, alert: alertMsg, daysActive: daysPassed };
};

export const getClientsAssignedToCredential = async (cred: AppCredential, preloadedClients?: any[]): Promise<ClientDBRow[]> => {
   const serviceName = cred.service;
   const allClients = preloadedClients || await getAllClients();
   const activeClients = allClients.filter((c: any) => !c.deleted);
   
   const clientsWithService = activeClients.filter((client: any) => {
      let subs: string[] = [];
      if (Array.isArray(client.subscriptions)) {
        subs = client.subscriptions;
      } else if (typeof client.subscriptions === 'string') {
        const s = client.subscriptions as string;
        subs = s.includes('+') ? s.split('+') : [s];
      }
      return subs.some((s: string) => s.toLowerCase().includes(serviceName.toLowerCase()));
   });
   
   clientsWithService.sort((a: any, b: any) => a.phone_number.localeCompare(b.phone_number));

   const allCredsRaw = await fetchCredentials();
   const allCreds = allCredsRaw
    .filter(c => c.isVisible && c.service.toLowerCase().includes(serviceName.toLowerCase()))
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

   const credIndex = allCreds.findIndex(c => c.id === cred.id);
   if (credIndex === -1) return [];

   let capacity = 4;
   if (serviceName.toLowerCase().includes('iqiyi')) {
      capacity = allCreds.length > 0 ? Math.ceil(clientsWithService.length / allCreds.length) : 1;
   } else if (serviceName.toLowerCase().includes('wetv')) {
      capacity = 1000;
   }

   const assignedUsers: ClientDBRow[] = [];
   for (let i = 0; i < clientsWithService.length; i++) {
      const assignedIndex = Math.floor(i / capacity) % allCreds.length;
      if (assignedIndex === credIndex) {
        assignedUsers.push(clientsWithService[i]);
      }
   }

   return assignedUsers;
}

export const getUsersCountForCredential = async (cred: AppCredential, preloadedClients?: any[]): Promise<number> => {
   const users = await getClientsAssignedToCredential(cred, preloadedClients);
   return users.length;
}
