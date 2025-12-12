
import { supabase } from './clientService';
import { SupportFlowStep, User } from '../types';
import { getAssignedCredential } from './credentialService';

// --- MOCK DATA (FLUXO INTELIGENTE ATUALIZADO & AMIGÁVEL) ---
const MOCK_FLOWS: Record<string, SupportFlowStep> = {
    // =========================================================================
    // 1. RAIZ - ESCOLHA DO APP
    // =========================================================================
    'root': {
        id: 'root',
        message: 'Olá, minha querida! ❤️\n\nSou a **Doraminha**, sua ajudante virtual.\n\nEstou aqui para te explicar tudo com muita calma e carinho. Não precisa ter pressa, viu?\n\nQual aplicativo você quer assistir agora?',
        options: [
            { label: 'Viki Pass', next_step_id: 'viki_device_select' },
            { label: 'Kocowa+', next_step_id: 'kocowa_start' },
            { label: 'IQIYI', next_step_id: 'iqiyi_start' },
            { label: 'WeTV', next_step_id: 'wetv_start' },
            { label: 'DramaBox', next_step_id: 'dramabox_start' }
        ]
    },

    // =========================================================================
    // 2. DISPOSITIVO (VIKI)
    // =========================================================================
    'viki_device_select': {
        id: 'viki_device_select',
        message: 'Ótima escolha! O **Viki** é maravilhoso. 🥰\n\nAgora me conte: **onde** você quer assistir?',
        options: [
            { label: 'Na TV', next_step_id: 'viki_tv_model_select' },
            { label: 'No Celular/Tablet', next_step_id: 'viki_mobile_install_check' }
        ]
    },

    // =========================================================================
    // 3. MODELO DA TV (VIKI)
    // =========================================================================
    'viki_tv_model_select': {
        id: 'viki_tv_model_select',
        message: 'Para eu te ajudar direitinho, preciso saber a **marca da sua TV**.\n\nOlhe para o controle remoto ou para a borda da TV. Qual nome está escrito?',
        options: [
            { label: 'Samsung ou LG', next_step_id: 'viki_tv_sl_screen_check' },
            { label: 'TCL, Roku, Toshiba ou Philco', next_step_id: 'viki_tv_tcl_check' },
            { label: 'Android TV / Google', next_step_id: 'viki_tv_tcl_check' },
            { label: 'Não sei / Outra', next_step_id: 'viki_tv_sl_fail' }
        ]
    },

    // =========================================================================
    // 4. FLUXO SAMSUNG / LG (Conexão via Código/Browser)
    // =========================================================================
    
    // 4.1 Diagnóstico da Tela
    'viki_tv_sl_screen_check': {
        id: 'viki_tv_sl_screen_check',
        message: 'Agora ligue sua TV e abra o aplicativo do **Viki**.\n\nOlhe bem para a tela da TV. O que está aparecendo?',
        options: [
            { label: 'Código de números', next_step_id: 'viki_tv_sl_code_guide' },
            { label: 'Botão "Entrar" ou "Iniciar"', next_step_id: 'viki_tv_sl_click_login' },
            { label: 'Botão "Sair"', next_step_id: 'viki_tv_sl_logout_first' }
        ]
    },

    // 4.2 Cenário: Botão Sair (Precisa deslogar primeiro)
    'viki_tv_sl_logout_first': {
        id: 'viki_tv_sl_logout_first',
        message: 'Entendi! Parece que tem uma **conta antiga** atrapalhando.\n\nPrecisamos tirar ela primeiro:\n1. Use o controle da TV e vá até o botão **Sair**.\n2. Clique nele e confirme que quer sair.\n\nDepois que sair, a tela vai mudar. O que apareceu agora?',
        options: [
            { label: 'Agora apareceu "Entrar"', next_step_id: 'viki_tv_sl_click_login' }
        ]
    },

    // 4.3 Cenário: Tela Inicial (Precisa clicar em Entrar)
    'viki_tv_sl_click_login': {
        id: 'viki_tv_sl_click_login',
        message: 'Certo! Com o controle da TV, clique nesse botão escrito **Entrar** ou **Iniciar Sessão**.\n\nAssim que você clicar, deve aparecer um **código de 6 números** grande na tela.',
        options: [
            { label: 'Sim! Apareceu o código', next_step_id: 'viki_tv_sl_code_guide' },
            { label: 'Não apareceu código', next_step_id: 'viki_tv_sl_fail' }
        ]
    },

    // 4.4 O CÓDIGO APARECEU - Início do processo de link
    'viki_tv_sl_code_guide': {
        id: 'viki_tv_sl_code_guide',
        message: 'Perfeito! Deixe esse **código quietinho na TV**, não feche essa tela. 📺\n\nAgora pegue seu **celular**. Vamos usar ele para liberar a TV.\n\nQual a marca da sua TV mesmo?',
        options: [
            { label: 'Samsung', next_step_id: 'viki_tv_samsung_link_action' },
            { label: 'LG', next_step_id: 'viki_tv_lg_link_action' }
        ]
    },

    // 4.5 Link Samsung
    'viki_tv_samsung_link_action': {
        id: 'viki_tv_samsung_link_action',
        message: 'Vou te passar o endereço do site da Samsung agora.\n\nVocê vai **Copiar** esse endereço e colar no seu navegador (Chrome ou Safari) usando uma **GUIA ANÔNIMA**.',
        options: [
            { label: 'Copiar Link Samsung', action: 'link', action_value: 'https://www.viki.com/samsungtv', next_step_id: 'viki_tv_sl_site_check' }
        ]
    },

    // 4.6 Link LG
    'viki_tv_lg_link_action': {
        id: 'viki_tv_lg_link_action',
        message: 'Vou te passar o endereço do site da LG agora.\n\nVocê vai **Copiar** esse endereço e colar no seu navegador (Chrome ou Safari) usando uma **GUIA ANÔNIMA**.',
        options: [
            { label: 'Copiar Link LG', action: 'link', action_value: 'https://www.viki.com/lgtv', next_step_id: 'viki_tv_sl_site_check' }
        ]
    },

    // 4.7 Verificação do Site
    'viki_tv_sl_site_check': {
        id: 'viki_tv_sl_site_check',
        message: 'O site abriu direitinho?\n\nProcure por um botão azul escrito **"Login"**, **"Entrar"** ou **"Conecte-se"**.\n\nVocê achou esse botão?',
        options: [
            { label: 'Sim, achei o botão', next_step_id: 'viki_tv_sl_login_process' },
            { label: 'Não abriu / Deu erro', next_step_id: 'viki_tv_sl_fail' }
        ]
    },

    // 4.8 Login no Site
    'viki_tv_sl_login_process': {
        id: 'viki_tv_sl_login_process',
        message: 'Que bom! 😍\n\n1. Clique nesse botão de **Entrar/Login**.\n2. Vai pedir **Email** e **Senha**.\n\nEu vou te dar o Email e a Senha agora. Você só precisa copiar e colar lá no site:',
        options: [
            { label: 'Copiar Email e Senha', action: 'copy_credential', action_value: 'viki', next_step_id: 'viki_tv_sl_input_code' }
        ]
    },

    // 4.9 Inserir Código Final
    'viki_tv_sl_input_code': {
        id: 'viki_tv_sl_input_code',
        message: 'Depois de colocar o email e senha e entrar, o site vai mudar.\n\nAgora vai aparecer um espaço escrito **"Digite o código"**.\n\n1. Olhe para sua TV e veja aquele número que apareceu antes.\n2. **Digite ele** no celular.\n3. Clique no botão azul **"Ligar Agora"** ou **"Conectar"**.\n\nA TV deve funcionar na hora! 🎉',
        options: [
            { label: 'Deu certo! Obrigada', next_step_id: 'root' },
            { label: 'Não consegui', next_step_id: 'viki_tv_sl_fail' }
        ]
    },

    // Falha genérica TV
    'viki_tv_sl_fail': {
        id: 'viki_tv_sl_fail',
        message: 'Não se preocupe, meu anjo! Às vezes a tecnologia é teimosa mesmo.\n\nVamos fazer assim: clique no botão verde abaixo. Uma pessoa de verdade vai te ajudar pelo WhatsApp, passo a passo, com muita calma.',
        options: [
            { label: 'Falar com Suporte Humano', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Ol%C3%A1!%20Tentei%20conectar%20o%20Viki%20na%20TV%20pelo%20guia%20mas%20n%C3%A3o%20consegui,%20preciso%20de%20ajuda.', next_step_id: 'root' }
        ]
    },


    // =========================================================================
    // 5. FLUXO TCL / ROKU (Login Direto na TV)
    // =========================================================================
    'viki_tv_tcl_check': {
        id: 'viki_tv_tcl_check',
        message: 'Nas TVs **TCL, Roku ou Android**, é mais simples!\n\n1. Abra o Viki na TV.\n2. Procure no cantinho lá embaixo um botão escrito **"Entrar com Email"** ou **"Login"**.\n\nVocê encontrou?',
        options: [
            { label: 'Sim, achei', next_step_id: 'viki_tv_tcl_credentials' },
            { label: 'Não achei', next_step_id: 'viki_tv_tcl_not_found' }
        ]
    },
    'viki_tv_tcl_credentials': {
        id: 'viki_tv_tcl_credentials',
        message: 'Ótimo! Clique nesse botão.\n\nAgora vai aparecer um teclado na TV para você digitar.\n\nVou te passar o **Email** e a **Senha**. Digite com bastante calma, letra por letra, tá bom?',
        options: [
            { label: 'Copiar meus dados', action: 'copy_credential', action_value: 'viki', next_step_id: 'root' }
        ]
    },
    'viki_tv_tcl_not_found': {
        id: 'viki_tv_tcl_not_found',
        message: 'Se o botão não apareceu, pode ser que o aplicativo esteja diferente na sua TV.\n\nNão tem problema! Chame nosso suporte que vamos olhar uma foto da sua TV e te mostrar onde clicar.',
        options: [
            { label: 'Chamar Ajuda WhatsApp', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Minha%20TV%20TCL/Roku%20n%C3%A3o%20mostra%20a%20op%C3%A7%C3%A3o%20de%20entrar%20com%20email.', next_step_id: 'root' }
        ]
    },


    // =========================================================================
    // 6. FLUXO CELULAR / TABLET (VIKI)
    // =========================================================================
    'viki_mobile_install_check': {
        id: 'viki_mobile_install_check',
        message: 'Vamos conectar no celular!\n\nPrimeira coisa: Você já baixou o aplicativo do **Viki** no seu celular?',
        options: [
            { label: 'Sim, já tenho', next_step_id: 'viki_mobile_screen_check' },
            { label: 'Ainda não baixei', next_step_id: 'viki_mobile_download_instruct' }
        ]
    },
    'viki_mobile_download_instruct': {
        id: 'viki_mobile_download_instruct',
        message: 'Sem problemas! Vá na "lojinha" do seu celular (Play Store ou App Store), escreva **Viki** e clique em instalar.\n\nDepois que instalar, abra o app e volte aqui.',
        options: [
            { label: 'Pronto, já abri', next_step_id: 'viki_mobile_screen_check' }
        ]
    },
    'viki_mobile_screen_check': {
        id: 'viki_mobile_screen_check',
        message: 'Com o app aberto, o que você está vendo?\n\n1. Vários desenhos de novelas (Banners)?\n2. OU uma tela inicial com botões de **"Inscreva-se"** e **"Entrar"**?',
        options: [
            { label: 'Vejo desenhos de novelas', next_step_id: 'viki_mobile_logout_steps' },
            { label: 'Vejo a tela de Entrar', next_step_id: 'viki_mobile_login_grey' }
        ]
    },
    
    // 6.1 Logout no Mobile
    'viki_mobile_logout_steps': {
        id: 'viki_mobile_logout_steps',
        message: 'Ah, então você deve estar numa conta antiga ou gratuita. Precisamos sair dela para colocar a VIP.\n\nFaça assim:\n1. Clique em **"Eu"** (lá embaixo no canto).\n2. Clique na **Engrenagem ⚙️** (lá em cima).\n3. Role a tela até o final e clique em **Sair** (vermelho).\n\nConseguiu sair?',
        options: [
            { label: 'Pronto, saí', next_step_id: 'viki_mobile_login_grey' }
        ]
    },

    // 6.2 Login no Mobile
    'viki_mobile_login_grey': {
        id: 'viki_mobile_login_grey',
        message: 'Agora você deve estar vendo uma tela com botões.\n\n1. Clique no botão **"Entrar"** (geralmente é branco ou cinza).\n2. DEPOIS, escolha a opção **"Entrar com Email"**.\n\n⚠️ **Atenção:** Não clique em Google ou Facebook, tá?',
        options: [
            { label: 'Apareceu para digitar', next_step_id: 'viki_mobile_creds' }
        ]
    },
    'viki_mobile_creds': {
        id: 'viki_mobile_creds',
        message: 'Perfeito! Agora é só copiar os dados que vou te dar.\n\nUse o botão de "Copiar" para não errar nenhuma letrinha.',
        options: [
            { label: 'Copiar Login e Senha', action: 'copy_credential', action_value: 'viki', next_step_id: 'root' }
        ]
    },


    // =========================================================================
    // 7. FLUXO IQIYI (Inteligente & Amigável)
    // =========================================================================
    
    // 7.1 Início e Triagem
    'iqiyi_start': {
        id: 'iqiyi_start',
        message: 'Para o **IQIYI** (O aplicativo verde), tem um segredinho: **Tudo começa pelo celular**! 📲\n\nMesmo se você quiser ver na TV, a gente precisa conectar no celular primeiro.\n\nVocê já tem o IQIYI no seu celular?',
        options: [
            { label: 'Sim, já tenho', next_step_id: 'iqiyi_check_status' },
            { label: 'Não tenho ainda', next_step_id: 'iqiyi_download_instruct' }
        ]
    },
    'iqiyi_download_instruct': {
        id: 'iqiyi_download_instruct',
        message: 'Tudo bem! Vá na lojinha do seu celular, procure por **IQIYI** e instale.\n\nMe avise quando terminar.',
        options: [
            { label: 'Pronto, instalei', next_step_id: 'iqiyi_check_status' }
        ]
    },

    // 7.2 Diagnóstico na aba "Eu"
    'iqiyi_check_status': {
        id: 'iqiyi_check_status',
        message: 'Agora abra o IQIYI no celular e clique em **"Eu"** (ou "Me") lá embaixo no cantinho direito.\n\nOlhe para o **topo** da tela. O que está escrito lá?',
        options: [
            { label: 'Início de sessão/registro', next_step_id: 'iqiyi_login_options' },
            { label: 'Nome de outra pessoa', next_step_id: 'iqiyi_logout_flow' },
            { label: 'EuDorama (VIP)', next_step_id: 'iqiyi_tv_prompt' }
        ]
    },

    // 7.3 Fluxo de Logout (Se tiver conta pessoal)
    'iqiyi_logout_flow': {
        id: 'iqiyi_logout_flow',
        message: 'Ah, tem uma conta antiga logada. Vamos tirar ela.\n\n1. Nessa mesma tela, procure por **Definições** (ou uma Engrenagem ⚙️).\n2. Clique em **Terminar sessão** ou **Sair**.\n3. Confirme que quer sair.\n\nDepois que sair, me avise.',
        options: [
            { label: 'Pronto, saí da conta', next_step_id: 'iqiyi_login_options' }
        ]
    },

    // 7.4 Opções de Login
    'iqiyi_login_options': {
        id: 'iqiyi_login_options',
        message: 'Agora clique no botão verde **"Início de sessão/registro"** lá em cima.\n\nO que apareceu na tela?',
        options: [
            { label: 'Email com estrelinhas (o***@g...)', next_step_id: 'iqiyi_verify_masked_email' },
            { label: 'Várias opções', next_step_id: 'iqiyi_login_manual_entry' }
        ]
    },

    // 7.5 Cenário: Email já salvo (Validar se é o nosso)
    'iqiyi_verify_masked_email': {
        id: 'iqiyi_verify_masked_email',
        message: 'Opa, o celular lembrou de uma conta! Precisamos ver se é a **nossa** ou a **sua antiga**.\n\nVou te mostrar os dados da nossa conta agora. Veja se o final do email na tela é igual ao que vou te mandar:',
        options: [
            { label: 'Comparar dados', action: 'copy_credential', action_value: 'iqiyi', next_step_id: 'iqiyi_masked_decision' }
        ]
    },
    'iqiyi_masked_decision': {
        id: 'iqiyi_masked_decision',
        message: 'Olhe bem para o email na tela e o que te mandei.\n\nO finalzinho deles é igual?',
        options: [
            { label: 'Sim, é igual', next_step_id: 'iqiyi_login_masked_pass' },
            { label: 'Não, é diferente', next_step_id: 'iqiyi_switch_account' }
        ]
    },
    
    // 7.5.1 Apenas Senha (Email correto salvo)
    'iqiyi_login_masked_pass': {
        id: 'iqiyi_login_masked_pass',
        message: 'Perfeito! Então é só colocar a senha.\n\n1. No campo **"Insira a palavra-passe"**, cole a senha que te mandei.\n2. Clique no botão verde **"Iniciar Sessão"**.\n3. Pode aparecer um quebra-cabeça, é só arrastar a pecinha.\n\nDeu certo?',
        options: [
            { label: 'Sim, conectou', next_step_id: 'iqiyi_tv_prompt' },
            { label: 'Deu erro na senha', next_step_id: 'iqiyi_switch_account' }
        ]
    },

    // 7.5.2 Trocar conta (Email errado salvo)
    'iqiyi_switch_account': {
        id: 'iqiyi_switch_account',
        message: 'Entendi, então vamos trocar para a conta certa.\n\nProcure um botão pequeno escrito **"Mudar de conta"** ou volte e clique de novo até aparecer as opções de login.\n\nQuando aparecer para escolher como entrar, me avise.',
        options: [
            { label: 'Apareceram as opções', next_step_id: 'iqiyi_login_manual_entry' }
        ]
    },

    // 7.6 Login Manual (Limpo)
    'iqiyi_login_manual_entry': {
        id: 'iqiyi_login_manual_entry',
        message: 'Vamos lá, vamos colocar a conta certa!\n\n1. Escolha a opção **"Iniciar sessão com palavra-passe"** (ou ícone de carta/email).\n2. **NÃO** use Google ou Facebook.\n\nVou te dar os dados para copiar e colar:',
        options: [
            { label: 'Copiar Login e Senha', action: 'copy_credential', action_value: 'iqiyi', next_step_id: 'iqiyi_manual_confirm' }
        ]
    },
    'iqiyi_manual_confirm': {
        id: 'iqiyi_manual_confirm',
        message: 'Depois de colocar email e senha, clique no botão verde **"Iniciar sessão"** e resolva o quebra-cabeça se aparecer.\n\nVocê conseguiu entrar?',
        options: [
            { label: 'Sim, estou logada', next_step_id: 'iqiyi_tv_prompt' },
            { label: 'Deu erro', next_step_id: 'iqiyi_tv_fail' }
        ]
    },

    // 7.7 Decisão Pós-Login: TV ou Fim
    'iqiyi_tv_prompt': {
        id: 'iqiyi_tv_prompt',
        message: 'Parabéns! 🎉 Você já está conectada no celular.\n\nVocê quer assistir só no celular ou quer conectar na **TV** também?',
        options: [
            { label: 'Conectar na TV', next_step_id: 'iqiyi_tv_start' },
            { label: 'Só no celular', next_step_id: 'root' }
        ]
    },

    // 7.8 Fluxo de TV (QR Code)
    'iqiyi_tv_start': {
        id: 'iqiyi_tv_start',
        message: 'Para a TV é super fácil agora que o celular está pronto!\n\n1. Abra o app do IQIYI na sua TV.\n2. Deve aparecer um **QR Code** (aquele quadrado preto cheio de pontinhos) na tela.\n\nEle apareceu?',
        options: [
            { label: 'Sim, apareceu', next_step_id: 'iqiyi_tv_scan' },
            { label: 'Não apareceu', next_step_id: 'iqiyi_tv_fail' }
        ]
    },
    'iqiyi_tv_scan': {
        id: 'iqiyi_tv_scan',
        message: 'Ótimo! Agora pegue seu celular (que já está logado):\n\n1. Clique em **"Eu"** novamente.\n2. Olhe lá no topo, perto de um sino 🔔, tem um desenho de um **quadradinho com um traço** (Scanner).\n3. Clique nele. A câmera vai abrir.\n4. Aponte o celular para a TV!\n\nDeve conectar na hora! ✨',
        options: [
            { label: 'Conectou! Obrigada', next_step_id: 'root' },
            { label: 'Não achei o scanner', next_step_id: 'iqiyi_tv_fail' }
        ]
    },
    'iqiyi_tv_fail': {
        id: 'iqiyi_tv_fail',
        message: 'Se deu algo errado, não fique triste!\n\nClique no botão abaixo que vamos te ajudar pelo WhatsApp. Mandamos até vídeo ensinando!',
        options: [
            { label: 'Pedir Ajuda Humana', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Ol%C3%A1!%20Estou%20com%20dificuldade%20no%20IQIYI,%20pode%20me%20ajudar?', next_step_id: 'root' }
        ]
    },

    // =========================================================================
    // 8. FLUXO KOCOWA+
    // =========================================================================
    'kocowa_start': {
        id: 'kocowa_start',
        message: 'Vamos configurar o **Kocowa+**! 💛\n\nOnde você vai assistir?',
        options: [
            { label: 'No Celular/Tablet', next_step_id: 'kocowa_mobile_check' },
            { label: 'Na TV', next_step_id: 'kocowa_tv_check' }
        ]
    },

    // FLOW MOBILE
    'kocowa_mobile_check': {
        id: 'kocowa_mobile_check',
        message: 'Você já tem o aplicativo do Kocowa instalado?',
        options: [
            { label: 'Sim, já tenho', next_step_id: 'kocowa_mobile_reinstall' },
            { label: 'Não tenho ainda', next_step_id: 'kocowa_mobile_install' }
        ]
    },
    'kocowa_mobile_install': {
        id: 'kocowa_mobile_install',
        message: 'Vá na lojinha de aplicativos, procure por **Kocowa** e instale.\n\nDepois que instalar, volte aqui.',
        options: [
            { label: 'Pronto, instalei', next_step_id: 'kocowa_mobile_login' }
        ]
    },
    'kocowa_mobile_reinstall': {
        id: 'kocowa_mobile_reinstall',
        message: '⚠️ **Dica de Ouro:**\n\nPara garantir que funcione de primeira, eu recomendo você **Desinstalar** o Kocowa e **Instalar de novo** agora.\n\nIsso limpa qualquer conta velha que esteja atrapalhando. Pode fazer isso rapidinho?',
        options: [
            { label: 'Pronto, reinstalei', next_step_id: 'kocowa_mobile_login' }
        ]
    },
    'kocowa_mobile_login': {
        id: 'kocowa_mobile_login',
        message: 'Agora abra o Kocowa.\n\n1. Clique no botão **"Entrar"**.\n2. Vai aparecer lugar para por email e senha.\n\nVou te dar os dados. Copie e cole e clique em **"Entrar com Kocowa"**:',
        options: [
            { label: 'Copiar Email e Senha', action: 'copy_credential', action_value: 'kocowa', next_step_id: 'kocowa_mobile_profile' }
        ]
    },
    'kocowa_mobile_profile': {
        id: 'kocowa_mobile_profile',
        message: 'Se deu certo, vai aparecer os perfis.\n\n👉 Escolha um perfil vazio ou crie um novo com seu nome.\n\nVocê conseguiu entrar?',
        options: [
            { label: 'Sim, deu certo', next_step_id: 'root' },
            { label: 'Deu erro', next_step_id: 'kocowa_support' }
        ]
    },

    // FLOW TV
    'kocowa_tv_check': {
        id: 'kocowa_tv_check',
        message: 'Abra o aplicativo do Kocowa na sua TV.\n\nO que você vê na tela inicial?',
        options: [
            { label: 'Botão "Entrar"', next_step_id: 'kocowa_tv_login' },
            { label: 'Filmes/Novelas direto', next_step_id: 'kocowa_support_tv' }
        ]
    },
    'kocowa_tv_login': {
        id: 'kocowa_tv_login',
        message: 'Ótimo! Clique em **"Entrar"**.\n\nVai aparecer o teclado da TV.\nDigite com calma os dados que vou te passar:',
        options: [
            { label: 'Copiar meus dados', action: 'copy_credential', action_value: 'kocowa', next_step_id: 'kocowa_tv_profile' }
        ]
    },
    'kocowa_tv_profile': {
        id: 'kocowa_tv_profile',
        message: 'Depois de digitar, entre e **crie seu perfil**.\n\nDeu tudo certo?',
        options: [
            { label: 'Conectado! Obrigada', next_step_id: 'root' },
            { label: 'Deu erro', next_step_id: 'kocowa_support' }
        ]
    },

    // KOCOWA SUPPORT FALLBACK
    'kocowa_support': {
        id: 'kocowa_support',
        message: 'Poxa, que pena. Mas não tem problema!\n\nClique no botão abaixo para chamar nosso suporte. Vamos resolver isso juntas.',
        options: [
            { label: 'Falar com Suporte', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Ajuda%20Kocowa%20Mobile', next_step_id: 'root' }
        ]
    },
    'kocowa_support_tv': {
        id: 'kocowa_support_tv',
        message: 'Se já aparecem as novelas mas você não logou, pode ser um erro do aplicativo antigo.\n\nChame o suporte que te ensinamos a limpar isso!',
        options: [
            { label: 'Chamar Ajuda', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Ajuda%20Kocowa%20TV%20Banners', next_step_id: 'root' }
        ]
    },

    // =========================================================================
    // 9. FLUXO WETV
    // =========================================================================
    'wetv_start': {
        id: 'wetv_start',
        message: 'Vamos configurar o **WeTV**! 🧡\n\nOnde você vai conectar?',
        options: [
            { label: 'No Celular/Tablet', next_step_id: 'wetv_mobile_check' },
            { label: 'Na TV', next_step_id: 'wetv_tv_start' }
        ]
    },

    // WETV MOBILE FLOW
    'wetv_mobile_check': {
        id: 'wetv_mobile_check',
        message: 'Você já tem o WeTV instalado no seu celular?',
        options: [
            { label: 'Sim', next_step_id: 'wetv_mobile_first_time' },
            { label: 'Não', next_step_id: 'wetv_mobile_install' }
        ]
    },
    'wetv_mobile_install': {
        id: 'wetv_mobile_install',
        message: 'Por favor, instale o **WeTV** pelas lojas de aplicativo oficiais.\n\nDepois abra o WeTV e volte aqui.',
        options: [
            { label: 'Pronto, abri o app', next_step_id: 'wetv_mobile_nav' }
        ]
    },
    'wetv_mobile_first_time': {
        id: 'wetv_mobile_first_time',
        message: 'É a **primeira vez** que você vai conectar com o **nosso login e senha** neste aparelho?',
        options: [
            { label: 'Sim', next_step_id: 'wetv_mobile_reinstall' },
            { label: 'Não', next_step_id: 'wetv_mobile_nav' }
        ]
    },
    'wetv_mobile_reinstall': {
        id: 'wetv_mobile_reinstall',
        message: 'Para garantir que não tenha contas antigas conectadas, por favor **Desinstale** e **Instale novamente** o WeTV agora.\n\nIsso é muito importante!',
        options: [
            { label: 'Pronto, reinstalei', next_step_id: 'wetv_mobile_nav' }
        ]
    },
    'wetv_mobile_nav': {
        id: 'wetv_mobile_nav',
        message: 'Abra o WeTV.\n\n1. Clique no botão com o nome **"Conta"** no canto inferior direito.\n2. Depois clique em **"Entrar"** na parte superior.\n3. Deverá aparecer um botão laranja escrito **(Telefone/E-mail)**. Clique nessa opção.\n\nApareceu para digitar?',
        options: [
            { label: 'Sim, apareceu', next_step_id: 'wetv_mobile_email_input' },
            { label: 'Não achei', next_step_id: 'wetv_tv_support' }
        ]
    },
    'wetv_mobile_email_input': {
        id: 'wetv_mobile_email_input',
        message: 'Agora digite o email que vou te passar e clique no botão laranja **"Próximo"**.',
        options: [
            { label: 'Copiar Email', action: 'copy_credential', action_value: 'wetv', next_step_id: 'wetv_mobile_pass_input' }
        ]
    },
    'wetv_mobile_pass_input': {
        id: 'wetv_mobile_pass_input',
        message: 'Vai aparecer outro campo. Digite a senha e clique em conectar.',
        options: [
            { label: 'Consegui conectar', next_step_id: 'root' },
            { label: 'Deu erro', next_step_id: 'wetv_tv_support' }
        ]
    },

    // WETV TV FLOW
    'wetv_tv_start': {
        id: 'wetv_tv_start',
        message: 'Abra o WeTV da TV e pesquise por um botão com o nome **"Entrar ou login"**.\n\nVocê deve clicar nele. O que apareceu?',
        options: [
            { label: 'Campo para Login e Senha', next_step_id: 'wetv_tv_login' },
            { label: 'Botão "Login with Email"', next_step_id: 'wetv_tv_email_click' },
            { label: 'Nada disso apareceu', next_step_id: 'wetv_tv_support' }
        ]
    },
    'wetv_tv_email_click': {
        id: 'wetv_tv_email_click',
        message: 'Isso! O usuário deve procurar um campo chamado **"login with email"**.\n\nO campo para inserir o login e senha deve aparecer.',
        options: [
            { label: 'Apareceu', next_step_id: 'wetv_tv_login' }
        ]
    },
    'wetv_tv_login': {
        id: 'wetv_tv_login',
        message: 'Se houver os campos, vou te indicar o login e senha agora:',
        options: [
            { label: 'Copiar Login e Senha', action: 'copy_credential', action_value: 'wetv', next_step_id: 'root' }
        ]
    },
    'wetv_tv_support': {
        id: 'wetv_tv_support',
        message: 'Se não apareceu o campo para login, encaminhe o usuário para o suporte.',
        options: [
            { label: 'Falar com Suporte', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Ajuda%20WeTV%20TV', next_step_id: 'root' }
        ]
    },


    // =========================================================================
    // 10. FLUXO DRAMABOX
    // =========================================================================
    'dramabox_start': {
        id: 'dramabox_start',
        message: '⚠️ **Atenção sobre o DramaBox** ⚠️\n\n1. Não funciona na TV.\n2. Não funciona em dispositivos iOS (iPhone).\n3. Apenas **Android**.\n\nVocê está no Android?',
        options: [
            { label: 'Sim, estou no Android', next_step_id: 'dramabox_support_chat' },
            { label: 'Não (TV ou iPhone)', next_step_id: 'dramabox_incompatible' }
        ]
    },
    'dramabox_support_chat': {
        id: 'dramabox_support_chat',
        message: 'Deverá indicar o usuário a falar com o suporte.',
        options: [
            { label: 'Falar com Suporte', action: 'open_url', action_value: 'https://wa.me/558894875029?text=Quero%20acesso%20ao%20DramaBox%20(Android)', next_step_id: 'root' }
        ]
    },
    'dramabox_incompatible': {
        id: 'dramabox_incompatible',
        message: 'Infelizmente não funciona nesses dispositivos.',
        options: [
            { label: 'Entendi', next_step_id: 'root' }
        ]
    }
};

export const fetchStep = async (stepId: string): Promise<SupportFlowStep | null> => {
    try {
        const { data } = await supabase
            .from('support_flows')
            .select('content')
            .eq('id', stepId)
            .single();

        if (data && data.content) {
            return { id: stepId, ...data.content };
        }
    } catch (e) {
        // Fallback
    }
    return MOCK_FLOWS[stepId] || MOCK_FLOWS['root'];
};

export const resolveCredentialAction = async (user: User, actionValue?: string): Promise<{ text: string, email?: string, password?: string }> => {
    if (!actionValue) return { text: "Erro: Serviço não especificado." };

    // --- LÓGICA DE CONTA DEMO (99999...) ---
    // Se for conta de demonstração, não busca no banco, retorna dados fictícios.
    if (user.phoneNumber.startsWith('99999')) {
        const demoEmail = `demo_${actionValue.toLowerCase().replace(/\s+/g, '')}@eudorama.com`;
        const demoPass = 'demo1234';
        return {
            text: `[MODO DEMONSTRAÇÃO]\n\nLogin: ${demoEmail}\nSenha: ${demoPass}`,
            email: demoEmail,
            password: demoPass
        };
    }

    // --- LÓGICA USUÁRIO REAL / TESTE GRÁTIS (0000...) ---
    const serviceName = user.services.find(s => s.toLowerCase().includes(actionValue.toLowerCase()));
    
    if (!serviceName) {
        return { text: `Poxa meu bem, parece que você não tem o plano do **${actionValue}** ativo ou ele venceu. 😢` };
    }

    const { credential } = await getAssignedCredential(user, serviceName);

    if (!credential) {
        return { text: "Ainda estamos preparando seu acesso. Aguarde um pouquinho ou chame o suporte no WhatsApp. ⏳" };
    }

    return {
        text: `Login: ${credential.email}\nSenha: ${credential.password}`,
        email: credential.email,
        password: credential.password
    };
};
