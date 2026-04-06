import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Swords, LogOut, Monitor, PlusCircle, UserPlus, Gamepad2, Settings, MapPin, LayoutList, Trash2, Pencil, Volume2, Network } from 'lucide-react';
import logo from './assets/logo.jpg';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('scoreboard');

  // States do Banco
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [courts, setCourts] = useState([]);
  const [sponsors, setSponsors] = useState([]);

  // Form States
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  const [newTName, setNewTName] = useState('');
  const [newCName, setNewCName] = useState('');
  const [newCourtName, setNewCourtName] = useState('');
  const [newSponsor, setNewSponsor] = useState({ name: '', logo_url: '' });
  const [atleta1, setAtleta1] = useState('');
  const [atleta2, setAtleta2] = useState('');
  const [matchP1, setMatchP1] = useState('');
  const [matchP2, setMatchP2] = useState('');
  const [matchCourt, setMatchCourt] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [elevenKey, setElevenKey] = useState(import.meta.env.VITE_ELEVENLABS_KEY || '');
  const [voiceKey, setVoiceKey] = useState('');
  const [tvMode, setTvMode] = useState('auto');
  const [tvTime, setTvTime] = useState(30);
  const [bracketSize, setBracketSize] = useState('8');

  // Edit States
  const [editingMatch, setEditingMatch] = useState(null);
  const [editP1, setEditP1] = useState('');
  const [editP2, setEditP2] = useState('');
  const [editCourt, setEditCourt] = useState('');
  const [editTime, setEditTime] = useState('');

  // Bracket/Groups States
  const [previewGroups, setPreviewGroups] = useState([]);
  const [groupSize, setGroupSize] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [groupType, setGroupType] = useState('auto'); // 'auto' ou 'manual'
  const [manualSlots, setManualSlots] = useState({}); // { 'A1': pairId, 'A2': pairId... }

  // Persistent TV Channel para Broadcasts instantâneos
  const [tvChannel, setTvChannel] = useState(null);
  useEffect(() => {
    const ch = supabase.channel('tv_rt', { config: { broadcast: { self: true } } });
    ch.subscribe();
    setTvChannel(ch);
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadData = async () => {
    try {
      const { data: tData } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      const { data: cData } = await supabase.from('categories').select('*');
      const { data: pData } = await supabase.from('pairs').select('*');
      const { data: coData } = await supabase.from('courts').select('*');
      const { data: mData } = await supabase.from('matches').select('*').order('updated_at', { ascending: false });
      const { data: spData } = await supabase.from('sponsors').select('*').order('created_at', { ascending: true });

      setTournaments(tData || []);
      const catMap = {}; (cData || []).forEach(c => catMap[c.id] = c);
      const pairMap = {}; (pData || []).forEach(p => pairMap[p.id] = p);
      const courtMap = {}; (coData || []).forEach(c => courtMap[c.id] = c);

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1: pairMap[m.pair1_id],
        pair2: pairMap[m.pair2_id],
        category: catMap[m.category_id],
        court: courtMap[m.court_id]
      }));

      setMatches(formatted);
      setCategories(cData || []);
      setCourts(coData || []);
      setPairs(pData || []);
      setSponsors(spData || []);

      const { data: sData, error: sError } = await supabase.from('settings').select('*');
      if (sError) console.warn("Erro ao buscar configurações:", sError.message);
      if (sData) {
        const el = sData.find(s => s.id === 'elevenlabs_key');
        if (el) setElevenKey(el.value);
        const vr = sData.find(s => s.id === 'voicerss_key');
        if (vr) setVoiceKey(vr.value);
        const tv = sData.find(s => s.id === 'tv_settings');
        if (tv) {
          try {
            const p = JSON.parse(tv.value);
            setTvMode(p.mode || 'auto');
            setTvTime(p.time || 30);
          } catch(e) {}
        }
      }
    } catch (e) { console.error("Erro no carregamento:", e); }
  };

  useEffect(() => { if (session) loadData(); }, [session, selectedT, selectedC]);

  const handleLogin = (e) => { e.preventDefault(); if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); } else alert('Senha Incorreta!'); };
  const handleLogout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const finishMatch = async (match, g1, g2, t1, t2) => {
    let games1 = parseInt(g1);
    let games2 = parseInt(g2);
    const tb1 = t1 ? parseInt(t1) : 0;
    const tb2 = t2 ? parseInt(t2) : 0;
    if (games1 === 6 && games2 === 6) {
      if (tb1 === 0 && tb2 === 0) return alert('⚠️ No 6x6 você deve preencher os pontos do Tie-break!');
      if (tb1 === tb2) return alert('⚠️ O Tie-break não pode terminar empatado!');
      if (tb1 > tb2) games1 = 7; else games2 = 7;
    } else if (games1 === games2) return alert('⚠️ Não pode haver empate!');

    const winnerId = games1 > games2 ? match.pair1_id : match.pair2_id;
    const { error } = await supabase.from('matches').update({
      pair1_games: games1, pair2_games: games2, pair1_tiebreak: tb1, pair2_tiebreak: tb2,
      status: 'finished', winner_id: winnerId, updated_at: new Date().toISOString()
    }).eq('id', match.id);
    if (error) {
      return alert(error.message);
    }
    
    if (tvChannel) {
      tvChannel.send({ type: 'broadcast', event: 'match_finished', payload: { matchId: match.id } });
    }

    // Se possui próxima partida na árvore de mata-mata, sobe o vencedor
    if (match.next_match_id) {
       // Descobre se ele deve entrar no pair1_id ou pair2_id do próximo jogo
       // Lógica simples: se o ID deste jogo for MENOR que o do seu par na chave, vai pro pair1. Caso contrário, pair2.
       // Para fins práticos aqui, vamos tentar preencher o primeiro slot vazio da próxima partida.
       const { data: nextMatch } = await supabase.from('matches').select('*').eq('id', match.next_match_id).single();
       if (nextMatch) {
         let updateField = 'pair1_id';
         if (nextMatch.pair1_id && nextMatch.pair1_id !== winnerId) updateField = 'pair2_id';
         await supabase.from('matches').update({ [updateField]: winnerId }).eq('id', match.next_match_id);
       }
    }
    
    alert('✅ Placar Oficializado!'); loadData();
  };

  const createTournament = async () => { 
    if (!newTName) return; 
    const { error } = await supabase.from('tournaments').insert([{ name: newTName }]);
    if (error) alert("Erro ao criar torneio: " + error.message);
    else { setNewTName(''); loadData(); }
  };
  const createCategory = async () => { 
    if (!selectedT || !newCName) return; 
    const { error } = await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]);
    if (error) alert("Erro ao criar categoria: " + error.message);
    else { setNewCName(''); loadData(); }
  };
  const createCourt = async () => { 
    if (!selectedT || !newCourtName) return; 
    const { error } = await supabase.from('courts').insert([{ tournament_id: selectedT, name: newCourtName }]);
    if (error) alert("Erro ao criar quadra: " + error.message);
    else { setNewCourtName(''); loadData(); }
  };
  const createSponsor = async () => { 
    if (!newSponsor.name || !newSponsor.logo_url) return; 
    const { error } = await supabase.from('sponsors').insert([newSponsor]);
    if (error) alert("Erro ao criar patrocinador: " + error.message);
    else { setNewSponsor({ name: '', logo_url: '' }); loadData(); }
  };
  const saveVoiceKey = async () => {
    if (!voiceKey) return;
    const { error } = await supabase.from('settings').upsert({ id: 'voicerss_key', value: voiceKey });
    if (error) alert(error.message); else alert('✅ Chave salva no banco!');
  };

  const saveTvSettings = async () => {
    const payload = { mode: tvMode, time: Number(tvTime) || 30 };
    const { error } = await supabase.from('settings').upsert({ id: 'tv_settings', value: JSON.stringify(payload) });
    if (error) {
      alert(error.message);
    } else {
      if (tvChannel) {
        tvChannel.send({
          type: 'broadcast',
          event: 'tv_settings',
          payload
        });
      }
      alert('✅ Exibição da TV atualizada!');
    }
  };

  const forceCallMatch = (m) => {
    if (!m.court_id) return alert('Por favor, edite a partida (Lápis) e informe a Quadra antes de chamar os jogadores na TV!');
    const tvMatchData = {
      ...m,
      pair1_name: m.pair1?.name || '?',
      pair2_name: m.pair2?.name || '?',
      category_name: m.category?.name || 'Geral',
      court_name: m.court?.name || 'Quadra'
    };
    if (tvChannel) {
      tvChannel.send({
        type: 'broadcast',
        event: 'call_match',
        payload: { match: tvMatchData }
      });
    }
    alert('📢 Aviso enviado instantaneamente para a TV!');
  };

  const deleteSponsor = async (id) => { 
    if (!window.confirm('Excluir este patrocinador?')) return; 
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) alert(error.message); else loadData();
  };
  const createPair = async () => { 
    if (!selectedC || !atleta1 || !atleta2) return; 
    const { error } = await supabase.from('pairs').insert([{ category_id: selectedC, name: `${atleta1} / ${atleta2}` }]);
    if (error) alert("Erro ao criar dupla: " + error.message);
    else { setAtleta1(''); setAtleta2(''); loadData(); }
  };
  const createMatch = async () => { 
    if (!selectedT || !selectedC || !matchP1 || !matchP2) return; 
    const { error } = await supabase.from('matches').insert([{ 
      tournament_id: selectedT, 
      category_id: selectedC, 
      pair1_id: matchP1 || null, 
      pair2_id: matchP2 || null, 
      court_id: matchCourt || null, 
      scheduled_time: matchTime || null, 
      status: 'pending' 
    }]);
    if (error) alert("Erro ao criar partida: " + error.message);
    else { 
      loadData(); 
      setActiveTab('scoreboard'); 
      if (tvChannel) tvChannel.send({ type: 'broadcast', event: 'sync_data' });
    }
  };

  const deleteMatch = async (id) => {
    if (!window.confirm('⚠️ Tem certeza que deseja APAGAR esta partida?')) return;
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) alert(error.message); else {
      loadData();
      if (tvChannel) tvChannel.send({ type: 'broadcast', event: 'sync_data' });
    }
  };

  const startEdit = (m) => {
    setEditingMatch(m);
    setEditP1(m.pair1_id || '');
    setEditP2(m.pair2_id || '');
    setEditCourt(m.court_id || '');
    setEditTime(m.scheduled_time || '');
  };

  const saveEdit = async () => {
    if (!editingMatch) return;
    const { error } = await supabase.from('matches').update({
      pair1_id: editP1 || null,
      pair2_id: editP2 || null,
      court_id: editCourt || null,
      scheduled_time: editTime || null,
      updated_at: new Date().toISOString()
    }).eq('id', editingMatch.id);

    if (error) alert(error.message);
    else {
      setEditingMatch(null);
      loadData();
      if (tvChannel) tvChannel.send({ type: 'broadcast', event: 'sync_data' });
    }
  };

  const generateManualBracket = async () => {
    if (!selectedC || !bracketSize) return alert('Selecione categoria e informe a quantidade de duplas!');
    const size = parseInt(bracketSize);
    if (![4, 8, 16, 32].includes(size)) return alert('Favor utilizar tamanhos padrão: 4, 8, 16 ou 32 para garantir a simetria da chave.');
    
    if (!window.confirm(`Isso gerará uma chave de ${size} duplas (mata-mata). Continuar?`)) return;
    
    setIsGenerating(true);
    try {
      // 1. Criar as rodadas de trás para frente (Final -> Semis -> Quartas...)
      // Final
      const { data: finalJoin, error: fError } = await supabase.from('matches').insert([{
        tournament_id: selectedT, category_id: selectedC, status: 'pending', stage: 'Final'
      }]).select().single();
      if (fError) throw fError;

      let currentRoundMatches = [finalJoin];
      let matchesPerRound = 2; // Para a próxima rodada (Semis)

      while (matchesPerRound <= (size / 2)) {
          const newRoundMatches = [];
          const stageName = matchesPerRound === 2 ? 'Semifinal' : matchesPerRound === 4 ? 'Quartas de Final' : matchesPerRound === 8 ? 'Oitavas de Final' : `Rodada de ${matchesPerRound*2}`;
          
          for (let m of currentRoundMatches) {
             // Para cada jogo da rodada seguinte, criamos 2 jogos que apontam para ele
             const { data: parents, error: pError } = await supabase.from('matches').insert([
               { tournament_id: selectedT, category_id: selectedC, status: 'pending', stage: stageName, next_match_id: m.id },
               { tournament_id: selectedT, category_id: selectedC, status: 'pending', stage: stageName, next_match_id: m.id }
             ]).select();
             if (pError) throw pError;
             newRoundMatches.push(...parents);
          }
          currentRoundMatches = newRoundMatches;
          matchesPerRound *= 2;
      }
      
      alert('✅ Chave Mata-Mata gerada com sucesso!');
      loadData();
      setActiveTab('scoreboard');
      if (tvChannel) tvChannel.send({ type: 'broadcast', event: 'sync_data' });
    } catch (e) {
      alert('Erro ao gerar chave: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateGroups = () => {
    if (!selectedC) return alert('Selecione uma categoria!');
    const categoryPairs = pairs.filter(p => p.category_id === selectedC);
    if (categoryPairs.length < 2) return alert('Necessário ao menos 2 duplas nesta categoria!');

    const size = Math.min(categoryPairs.length, 12);
    const shuffled = [...categoryPairs.slice(0, size)].sort(() => Math.random() - 0.5);
    
    const countPerGroup = Number(groupSize);
    const numGroups = Math.ceil(shuffled.length / countPerGroup);
    const newSlots = {};
    
    let pairIdx = 0;
    for (let g = 0; g < numGroups; g++) {
      const letter = String.fromCharCode(65 + g);
      for (let s = 1; s <= countPerGroup; s++) {
        if (pairIdx < shuffled.length) {
          newSlots[`${letter}${s}`] = shuffled[pairIdx].id;
          pairIdx++;
        }
      }
    }
    setManualSlots(newSlots);
    setGroupType('manual'); // Mostra a interface de slots preenchida
  };

  const saveGroups = async () => {
    const categoryPairs = pairs.filter(p => p.category_id === selectedC);
    // Agrupa os slots por letra de grupo
    const finalGroups = {};
    Object.keys(manualSlots).forEach(key => {
      const letter = key[0];
      const pairId = manualSlots[key];
      if (pairId) {
        if (!finalGroups[letter]) finalGroups[letter] = [];
        finalGroups[letter].push(categoryPairs.find(p => p.id === pairId));
      }
    });

    const groupsArray = Object.keys(finalGroups).sort().map(letter => ({
      name: `Grupo ${letter}`,
      pairs: finalGroups[letter]
    }));

    if (groupsArray.length === 0) return alert('Preencha ao menos um grupo!');
    if (!window.confirm('Confirmar a criação destes grupos no banco?')) return;
    
    setIsGenerating(true);
    const matchesToCreate = [];

    groupsArray.forEach(group => {
      for (let i = 0; i < group.pairs.length; i++) {
        for (let j = i + 1; j < group.pairs.length; j++) {
          matchesToCreate.push({
            tournament_id: selectedT,
            category_id: selectedC,
            pair1_id: group.pairs[i].id,
            pair2_id: group.pairs[j].id,
            status: 'pending',
            stage: group.name
          });
        }
      }
    });

    const { error } = await supabase.from('matches').insert(matchesToCreate);
    setIsGenerating(false);

    if (error) {
      alert('Erro ao salvar chaves: ' + error.message);
    } else {
      alert('✅ Fase de Grupos gerada com sucesso!');
      setPreviewGroups([]);
      loadData();
      setActiveTab('scoreboard');
      if (tvChannel) tvChannel.send({ type: 'broadcast', event: 'sync_data' });
    }
  };

  if (!session) return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', padding: 20 }}>
      {/* Remover borda do card de login para integrar a logo perfeitamente */}
      <div className="app-card" style={{ width: '100%', maxWidth: 400, textAlign: 'center', padding: '40px 20px', border: 'none', boxShadow: 'none' }}>
        <img src={logo} alt="Careca's Logo" style={{ width: 140, marginBottom: 20, display: 'block', margin: '0 auto 20px' }} />
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: 30, letterSpacing: 2, fontSize: '0.9rem' }}>ACESSO RESTRITO</h2>
        <form onSubmit={handleLogin}><input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} /><button type="submit" className="btn-primary" style={{ width: '100%', padding: 18 }}>ENTRAR AGORA</button></form>
      </div>
    </div>
  );

  return (
    <div className="admin-wrapper">
      {/* SIDEBAR (Desktop Only) */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', justifyContent: 'center' }}>
          <img src={logo} alt="Logo" style={{ width: 200, height: 'auto' }} />
        </div>
        <nav className="nav-group">
          <div className={`nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20} /> Score (Ativos)</div>
          <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><LayoutList size={20} /> Partidas (Encerradas)</div>
          <div className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Gamepad2 size={20} /> Agendar Jogo</div>
          <div className={`nav-item ${activeTab === 'brackets' ? 'active' : ''}`} onClick={() => setActiveTab('brackets')}><Network size={20} /> Chaveamento</div>
          <div className={`nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><UserPlus size={20} /> Duplas</div>
          <div className={`nav-item ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><Settings size={20} />Configurar</div>
          <div style={{ marginTop: 'auto' }}><a href="/tv" target="_blank" className="nav-item" style={{ textDecoration: 'none' }}><Monitor size={20} /> Ver TV</a><div className="nav-item" onClick={handleLogout} style={{ color: 'var(--accent-secondary)' }}><LogOut size={20} /> Sair</div></div>
        </nav>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-nav" style={{ justifyContent: 'space-around', padding: '0 5px' }}>
        <div className={`m-nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20} /><small>Score</small></div>
        <div className={`m-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><LayoutList size={20} /><small>Partidas</small></div>
        <div className={`m-nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Gamepad2 size={20} /><small>Agendar</small></div>
        <div className={`m-nav-item ${activeTab === 'brackets' ? 'active' : ''}`} onClick={() => setActiveTab('brackets')}><Network size={20} /><small>Chaves</small></div>
        <div className={`m-nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><UserPlus size={20} /><small>Duplas</small></div>
        <div className={`m-nav-item ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><Settings size={20} /><small>Setup</small></div>
      </nav>

      <main className="content-area">
        {/* LOGO MOBILE */}
        <div className="mobile-admin-logo">
          <img src={logo} alt="Logo" style={{ width: 120, height: 'auto' }} />
        </div>

        {activeTab === 'scoreboard' && (
          <div>
            <h1 className="section-title">Em Quadra / Próximos</h1>
             <p style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center', marginBottom: 20 }}>Edite (no Lápis) para definir quadra/horário. Jogos sem dupla fechada não aparecem aqui.</p>
            {matches.filter(m => m.status !== 'finished' && m.pair1_id && m.pair2_id).map(m => (
              <div key={m.id} className="app-card" style={{ borderLeftColor: 'var(--accent-primary)', paddingTop: 10 }}>
                {/* Barra de Topo do Card (Ações) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 5px 10px 0', gap: 8 }}>
                  <button
                    onClick={() => forceCallMatch(m)}
                    title="Chamar na TV Agora"
                    style={{ background: 'rgba(212,175,55,0.1)', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Volume2 size={18} />
                  </button>
                  <button
                    onClick={() => startEdit(m)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    < Pencil size={18} />
                  </button>
                  <button
                    onClick={() => deleteMatch(m.id)}
                    style={{ background: 'rgba(255,77,77,0.1)', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span className="cat-badge">{m.category?.name || 'Geral'}</span>
                  {m.court && <span className="cat-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>{m.court.name}</span>}
                  {m.scheduled_time && <span className="cat-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>{m.scheduled_time}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15, marginBottom: 25 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontWeight: 800, marginBottom: 10, fontSize: '0.9rem', height: '2rem' }}>{m.pair1?.name}</div><input id={`g1-${m.id}`} type="number" placeholder="0" style={{ width: 80, height: 80, textAlign: 'center', fontSize: '2rem', fontWeight: 900, marginBottom: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, color: '#fff' }} /></div>
                  <div style={{ fontSize: '1.5rem', opacity: 0.3, fontWeight: 900 }}>X</div>
                  <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontWeight: 800, marginBottom: 10, fontSize: '0.9rem', height: '2rem' }}>{m.pair2?.name}</div><input id={`g2-${m.id}`} type="number" placeholder="0" style={{ width: 80, height: 80, textAlign: 'center', fontSize: '2rem', fontWeight: 900, marginBottom: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, color: '#fff' }} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, opacity: 0.6, marginBottom: 20 }}>
                  <div><div style={{ fontSize: '0.6rem', textAlign: 'center', fontWeight: 900 }}>TB Pts</div><input id={`t1-${m.id}`} type="number" style={{ width: 60, padding: 8, textAlign: 'center', marginBottom: 0, background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff' }} /></div>
                  <div style={{ alignSelf: 'flex-end', paddingBottom: 10 }}>-</div>
                  <div><div style={{ fontSize: '0.6rem', textAlign: 'center', fontWeight: 900 }}>TB Pts</div><input id={`t2-${m.id}`} type="number" style={{ width: 60, padding: 8, textAlign: 'center', marginBottom: 0, background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff' }} /></div>
                </div>
                <button className="btn-primary" style={{ width: '100%', height: 60 }} onClick={() => {
                  const g1 = document.getElementById(`g1-${m.id}`).value;
                  const g2 = document.getElementById(`g2-${m.id}`).value;
                  const t1 = document.getElementById(`t1-${m.id}`).value;
                  const t2 = document.getElementById(`t2-${m.id}`).value;
                  if (g1 === '' || g2 === '') return alert('Games Mandatórios!');
                  finishMatch(m, g1, g2, t1, t2);
                }}>Lançar Placar</button>
              </div>
            ))}
            {matches.filter(m => m.status !== 'finished' && m.pair1_id && m.pair2_id).length === 0 && <p style={{ textAlign: 'center', opacity: 0.2, padding: 100, marginTop: 50 }}>Nenhum jogo aguardando placar no momento.</p>}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h1 className="section-title">Partidas Encerradas</h1>
            <div style={{ display: 'grid', gap: 12 }}>
              {matches.filter(m => m.status === 'finished').map(m => (
                <div key={m.id} className="app-card" style={{ padding: '15px 20px', borderLeft: '4px solid var(--accent-primary)', marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 12, opacity: 0.6, letterSpacing: 1 }}>
                    <span>{m.category?.name} • {m.court?.name}</span>
                    <span>{new Date(m.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* DUPLA 1 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: m.winner_id === m.pair1_id ? 900 : 400, color: m.winner_id === m.pair1_id ? '#fff' : '#888', flex: 1, paddingRight: 10, lineHeight: 1.2 }}>
                        {m.pair1?.name}
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-primary)', minWidth: 40, textAlign: 'right' }}>
                        {m.pair1_games}
                      </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '2px 0' }}></div>

                    {/* DUPLA 2 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: m.winner_id === m.pair2_id ? 900 : 400, color: m.winner_id === m.pair2_id ? '#fff' : '#888', flex: 1, paddingRight: 10, lineHeight: 1.2 }}>
                        {m.pair2?.name}
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-primary)', minWidth: 40, textAlign: 'right' }}>
                        {m.pair2_games}
                      </div>
                    </div>
                  </div>

                  {(m.pair1_tiebreak > 0 || m.pair2_tiebreak > 0) && (
                    <div style={{ textAlign: 'right', fontSize: '0.65rem', opacity: 0.3, marginTop: 8, fontStyle: 'italic' }}>
                      Pts Tie-break: ({m.pair1_tiebreak} - {m.pair2_tiebreak})
                    </div>
                  )}
                </div>
              ))}
              {matches.filter(m => m.status === 'finished').length === 0 && <p style={{ textAlign: 'center', opacity: 0.2, padding: 100 }}>Nenhum resultado registrado ainda.</p>}
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h1 className="section-title">Configurar</h1>

            <div className="app-card" style={{ borderLeftColor: 'var(--accent-primary)', marginBottom: 30 }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 15, color: 'var(--accent-primary)', fontWeight: 800 }}>Controle Automático ou Manual da TV</h2>
              
              <label className="input-label">Modo de Exibição / Tela Fixa</label>
              <select value={tvMode} onChange={e => setTvMode(e.target.value)} style={{ marginBottom: 15 }}>
                <option value="auto">Automático (Rotacionar todas)</option>
                <option value="0">Fixo: Painel Geral</option>
                <option value="1">Fixo: Próximas Partidas</option>
                <option value="2">Fixo: Mural de Resultados</option>
                <option value="3">Fixo: Patrocinadores</option>
                <option value="4">Fixo: Chaveamento (Mata-Mata)</option>
              </select>

              <label className="input-label">Tempo do Slide (segundos)</label>
              <input type="number" value={tvTime} onChange={e => setTvTime(e.target.value)} placeholder="Ex: 30" style={{ marginBottom: 20 }} />

              <button className="btn-primary" style={{ width: '100%', height: 50, marginTop: 10, fontWeight: 900 }} onClick={saveTvSettings}>APLICAR NA TV AGORA</button>
            </div>

            <div className="app-card"><label className="input-label">Novo Torneio</label><input value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Ex: Open Verão" /><button onClick={createTournament} className="btn-primary" style={{ width: '100%', height: 55 }}>Salvar Evento</button></div>
            {tournaments.length > 0 && (
              <>
                <div className="app-card"><label className="input-label">Selecionar Torneio</label><select value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Escolha...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                {selectedT && (
                  <div style={{ display: 'grid', gap: 20 }}>
                    <div className="app-card"><label className="input-label">Nova Categoria</label><div style={{ display: 'flex', gap: 10 }}><input value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Ex: Masculino A" style={{ marginBottom: 0 }} /><button onClick={createCategory} className="btn-primary" style={{ padding: '0 25px' }}><PlusCircle /></button></div></div>
                    <div className="app-card"><label className="input-label">Nova Quadra</label><div style={{ display: 'flex', gap: 10 }}><input value={newCourtName} onChange={e => setNewCourtName(e.target.value)} placeholder="Ex: Quadra 01" style={{ marginBottom: 0 }} /><button onClick={createCourt} className="btn-primary" style={{ padding: '0 25px' }}><MapPin /></button></div></div>
                    

                    <div className="app-card" style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">Patrocinadores (Logos)</label>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                        <input value={newSponsor.name} onChange={e => setNewSponsor({...newSponsor, name: e.target.value})} placeholder="Nome da Marca" style={{ marginBottom: 0 }} />
                        <input value={newSponsor.logo_url} onChange={e => setNewSponsor({...newSponsor, logo_url: e.target.value})} placeholder="URL da Logo (PNG ou JPG)" style={{ marginBottom: 0 }} />
                        <button onClick={createSponsor} className="btn-primary" style={{ padding: '0 25px' }}><PlusCircle /></button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 15 }}>
                        {sponsors.map(s => (
                          <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', position: 'relative' }}>
                            <img src={s.logo_url} alt={s.name} style={{ width: '100%', height: 40, objectFit: 'contain', marginBottom: 5 }} />
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>{s.name}</div>
                            <button onClick={() => deleteSponsor(s.id)} style={{ position: 'absolute', top: -5, right: -5, background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 10, cursor: 'pointer' }}>X</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'pairs' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h1 className="section-title">Criar Duplas</h1>
            <div className="app-card">
              <label className="input-label">Torneio e Categoria</label>
              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}><select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{ marginBottom: 0 }}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{ marginBottom: 0 }}><option value="">Categoria...</option>{categories.filter(c => c.tournament_id === selectedT).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              {selectedC && <><label className="input-label">Nomes dos Atletas</label><input placeholder="Atleta 1" value={atleta1} onChange={e => setAtleta1(e.target.value)} /><input placeholder="Atleta 2" value={atleta2} onChange={e => setAtleta2(e.target.value)} /><button onClick={createPair} className="btn-primary" style={{ width: '100%', height: 55 }}>REGISTRAR DUPLA</button></>}
            </div>
          </div>
        )}

        {activeTab === 'brackets' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="app-card" style={{ marginBottom: 30 }}>
              <label className="input-label">1. Selecione o Evento</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                <select value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                  <option value="">Torneio...</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={selectedC} onChange={e => setSelectedC(e.target.value)}>
                  <option value="">Categoria...</option>
                  {categories.filter(c => c.tournament_id === selectedT).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {selectedC && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 25, borderRadius: 20, border: '1px solid #333', marginBottom: 30 }}>
                    <label className="input-label" style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: 20 }}>2. Configuração da Fase de Grupos</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 25 }}>
                       <div>
                          <label className="input-label" style={{ fontSize: '0.6rem' }}>Tamanho de cada Grupo (Duplas)</label>
                          <select value={groupSize} onChange={e => setGroupSize(e.target.value)} style={{ marginBottom: 0 }}>
                            <option value="2">2 duplas</option>
                            <option value="3">3 duplas</option>
                            <option value="4">4 duplas</option>
                            <option value="5">5 duplas</option>
                            <option value="6">6 duplas</option>
                          </select>
                       </div>
                       <div>
                          <label className="input-label" style={{ fontSize: '0.6rem' }}>Mata-Mata Direto (Duplas)</label>
                          <input type="number" value={bracketSize} onChange={e => setBracketSize(e.target.value)} placeholder="Ex: 8" style={{ marginBottom: 0 }} />
                       </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                       <button className="btn-primary" style={{ flex: 1, height: 60, fontSize: '0.8rem', background: groupType === 'manual' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', color: groupType === 'manual' ? '#000' : '#fff' }} onClick={() => setGroupType('manual')}>MONTAR MANUAL</button>
                       <button className="btn-primary" style={{ flex: 1, height: 60, fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={generateGroups}>SORTEAR TUDO (RANDOM)</button>
                       <button className="btn-primary" style={{ flex: 1, height: 60, fontSize: '0.8rem', background: '#D4AF37', color: '#000' }} onClick={generateManualBracket}>GERAR MATA-MATA</button>
                    </div>
                  </div>

                  {groupType === 'manual' && (
                    <div style={{ marginTop: 20 }}>
                       <div style={{ background: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 12, marginBottom: 20, textAlign: 'center' }}>
                          <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>O sorteio distribuirá aleatoriamente as duplas cadastradas. Na montagem manual, você escolhe quem vai em cada slot abaixo.</p>
                       </div>

                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 40 }}>
                          {['A', 'B', 'C', 'D'].map(letter => {
                             const categoryPairs = pairs.filter(p => p.category_id === selectedC);
                             return (
                               <div key={letter} className="app-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #333' }}>
                                  <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: 15, textAlign: 'center' }}>GRUPO {letter}</h3>
                                  {[1, 2, 3, 4, 5, 6].slice(0, groupSize).map(slotNum => {
                                     const slotKey = `${letter}${slotNum}`;
                                     return (
                                       <div key={slotKey} style={{ marginBottom: 10 }}>
                                          <select 
                                            value={manualSlots[slotKey] || ''} 
                                            onChange={e => setManualSlots({...manualSlots, [slotKey]: e.target.value})}
                                            style={{ fontSize: '0.8rem', padding: '10px' }}
                                          >
                                             <option value="">-- Selecionar Dupla --</option>
                                             {categoryPairs.map(p => {
                                                const isTaken = Object.values(manualSlots).includes(p.id) && manualSlots[slotKey] !== p.id;
                                                return <option key={p.id} value={p.id} disabled={isTaken}>{p.name} {isTaken ? '(Já escalada)' : ''}</option>
                                             })}
                                          </select>
                                       </div>
                                     );
                                  })}
                               </div>
                             )
                          })}
                       </div>

                       <button 
                         className="btn-primary" 
                         style={{ width: '100%', height: 65, marginBottom: 60, fontSize: '1.1rem', background: '#2ecc71', borderColor: '#2ecc71', color: '#000' }} 
                         onClick={saveGroups}
                         disabled={isGenerating}
                       >
                         {isGenerating ? 'SALVANDO...' : 'FECHAR GRUPOS E CRIAR JOGOS'}
                       </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h1 className="section-title">Agendar Jogos</h1>
            <div className="app-card">
              <label className="input-label">Torneio e Categoria</label>
              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}><select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{ marginBottom: 0 }}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{ marginBottom: 0 }}><option value="">Categoria...</option>{categories.filter(c => c.tournament_id === selectedT).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              {selectedC && (
                <>
                  <label className="input-label">Escolher Confronto</label>
                  <select value={matchP1} onChange={e => setMatchP1(e.target.value)} style={{ marginBottom: 10 }}><option value="">Selecione Dupla 1</option>{pairs.filter(p => p.category_id === selectedC).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 10, color: 'var(--accent-primary)', fontSize: '0.7rem' }}>VERSUS</div>
                  <select value={matchP2} onChange={e => setMatchP2(e.target.value)}><option value="">Selecione Dupla 2</option>{pairs.filter(p => p.category_id === selectedC).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>

                  <label className="input-label" style={{ marginTop: 20 }}>Informações de Quadra</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <select value={matchCourt} onChange={e => setMatchCourt(e.target.value)}><option value="">Quadra...</option>{courts.filter(c => c.tournament_id === selectedT).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} />
                  </div>

                  <button onClick={createMatch} className="btn-primary" style={{ width: '100%', height: 60, marginTop: 10 }}>GERAR JOGO E QUADRA</button>
                </>
              )}
            </div>
          </div>
        )}



        {/* Modal de Edição */}
        {editingMatch && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
            <div className="app-card" style={{ width: '100%', maxWidth: 500, border: '1px solid #333' }}>
              <h2 style={{ color: 'var(--accent-primary)', marginBottom: 20, fontSize: '1.2rem' }}>Editar Partida</h2>
              <label className="input-label">Duplas</label>
              <select value={editP1} onChange={e => setEditP1(e.target.value)} style={{ marginBottom: 10 }}>
                <option value="">A Definir (Automático)</option>
                {pairs.filter(p => p.category_id === editingMatch.category_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 10, color: 'var(--accent-primary)', fontSize: '0.7rem' }}>VERSUS</div>
              <select value={editP2} onChange={e => setEditP2(e.target.value)}>
                <option value="">A Definir (Automático)</option>
                {pairs.filter(p => p.category_id === editingMatch.category_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label className="input-label" style={{ marginTop: 20 }}>Quadra e Horário</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select value={editCourt} onChange={e => setEditCourt(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {courts.filter(c => c.tournament_id === editingMatch.tournament_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gap: 12, marginTop: 30 }}>
                <button className="btn-primary" style={{ width: '100%', height: 60 }} onClick={saveEdit}>SALVAR ALTERAÇÕES</button>
                <button className="btn-primary" style={{ width: '100%', height: 60, background: 'rgba(255,255,255,0.05)', color: '#888' }} onClick={() => setEditingMatch(null)}>VOLTAR / CANCELAR</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
