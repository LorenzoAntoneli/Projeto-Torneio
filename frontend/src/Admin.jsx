import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, Swords, LayoutList, Users, LogOut, FileUp, Monitor, PlayCircle, Settings, PlusCircle, Gamepad2, UserPlus, CheckCircle2 } from 'lucide-react';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('scoreboard');
  
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  
  const [newTName, setNewTName] = useState('');
  const [newCName, setNewCName] = useState('');
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [matchP1, setMatchP1] = useState('');
  const [matchP2, setMatchP2] = useState('');

  const loadData = async () => {
    try {
      const { data: tData } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      const { data: cData } = await supabase.from('categories').select('*');
      const { data: pData } = await supabase.from('pairs').select('*');
      const { data: mData } = await supabase.from('matches').select('*').order('updated_at', { ascending: false });

      setTournaments(tData || []);
      const catMap = {}; (cData || []).forEach(c => catMap[c.id] = c);
      const pairMap = {}; (pData || []).forEach(p => pairMap[p.id] = p);

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1: pairMap[m.pair1_id],
        pair2: pairMap[m.pair2_id],
        category: catMap[m.category_id]
      }));

      setMatches(formatted);
      if (selectedT) setCategories((cData || []).filter(c => c.tournament_id === selectedT));
      if (selectedC) setPairs((pData || []).filter(p => p.category_id === selectedC));
    } catch(e) { console.error('Erro ao carregar:', e); }
  };

  useEffect(() => { if (session) loadData(); }, [session, selectedT, selectedC]);

  const login = (e) => { e.preventDefault(); if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); } else alert('Senha inválida'); };
  const logout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const createTournament = async () => { if (!newTName) return; await supabase.from('tournaments').insert([{ name: newTName }]); setNewTName(''); loadData(); };
  const createCategory = async () => { if (!selectedT || !newCName) return; await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]); setNewCName(''); loadData(); };
  const createPair = async () => { if (!selectedC || !p1Name || !p2Name) return; await supabase.from('pairs').insert([{ category_id: selectedC, name: `${p1Name} / ${p2Name}` }]); setP1Name(''); setP2Name(''); loadData(); };
  
  const createMatch = async () => { 
    if (!selectedT || !selectedC || !matchP1 || !matchP2) return alert('Selecione tudo!'); 
    const { error } = await supabase.from('matches').insert([{ 
      tournament_id: selectedT,
      category_id: selectedC, 
      pair1_id: matchP1, 
      pair2_id: matchP2, 
      pair1_games: 0, 
      pair2_games: 0, 
      status: 'pending' 
    }]); 
    if (error) alert('Erro: ' + error.message); else { alert('Sucesso!'); loadData(); setActiveTab('scoreboard'); }
  };

  const finishMatch = async (match, g1, g2) => {
    // Pegar o ID do vencedor com check de segurança
    const winnerId = parseInt(g1) > parseInt(g2) ? match.pair1_id : match.pair2_id;
    
    // Dados para atualizar (Payload limpo)
    const updateData = { 
        pair1_games: parseInt(g1), 
        pair2_games: parseInt(g2), 
        status: 'finished', 
        winner_id: winnerId || null,
        updated_at: new Date().toISOString() // ISOString é o formato seguro para Postgres
    };

    const { error } = await supabase.from('matches').update(updateData).eq('id', match.id);
    
    if (error) {
      console.error('ERRO DETALHADO SUPABASE:', error);
      alert(`ERRO AO FINALIZAR (400): ${error.message} - Verifique o console do navegador no F12 para detalhes.`);
    } else {
      alert('Resultado Finalizado com Sucesso!');
      loadData();
    }
  };

  if (!session) return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#000'}}>
      <div className="glass-panel" style={{padding:50, textAlign:'center', border:'2px solid var(--accent-primary)', width:400, borderRadius:32}}>
        <h2 style={{color:'#fff', marginBottom:30}}>CARECA’S CLUB</h2>
        <form onSubmit={login}><input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} style={{width:'100%', padding:12, marginBottom:20, background:'#111', border:'1px solid #333', color:'#fff'}} /><button type="submit" className="btn-primary" style={{width:'100%'}}>ENTRAR</button></form></div></div>
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar glass-panel">
        <div className="sidebar-brand">CARECA’S CLUB</div>
        <nav className="admin-nav">
          <div className={`nav-link ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}> <Swords size={18} /> Resultados</div>
          <div className={`nav-link ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}> <PlusCircle size={18} /> 1. Configurar</div>
          <div className={`nav-link ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}> <UserPlus size={18} /> 2. Duplas</div>
          <div className={`nav-link ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}> <Gamepad2 size={18} /> 3. Partidas</div>
          <div style={{flex:1}}></div>
          <a href="/tv" target="_blank" className="nav-link" style={{color:'var(--accent-primary)', textDecoration:'none'}}><Monitor size={18}/> Tela da TV</a>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'scoreboard' && (
          <div className="admin-view-container">
            <h2 className="view-title">Digitar Resultado Final</h2>
            <div className="matches-list">
              {matches.filter(m => m.status !== 'finished').map(m => (
                <div key={m.id} className="glass-panel match-ctrl-card">
                  <div className="card-header"><span className="cat-badge">{m.category?.name || 'Iniciante'}</span></div>
                  <div style={{display:'flex', alignItems:'center', gap:20, justifyContent:'center', marginTop:20}}>
                    <div style={{textAlign:'center',flex:1}}><div style={{fontWeight:'900', color:'#fff', marginBottom:15}}>{m.pair1?.name || 'Dupla 1'}</div><input id={`g1-${m.id}`} type="number" placeholder="0" style={{width:80, height:80, fontSize:'2.5rem', textAlign:'center', borderRadius:12}} /></div>
                    <div style={{opacity:0.3, fontSize:'2rem'}}>X</div>
                    <div style={{textAlign:'center',flex:1}}><div style={{fontWeight:'900', color:'#fff', marginBottom:15}}>{m.pair2?.name || 'Dupla 2'}</div><input id={`g2-${m.id}`} type="number" placeholder="0" style={{width:80, height:80, fontSize:'2.5rem', textAlign:'center', borderRadius:12}} /></div>
                  </div>
                  <button className="btn-primary" style={{width:'100%', marginTop:30, height:65}} onClick={() => {
                     const g1Val = document.getElementById(`g1-${m.id}`).value;
                     const g2Val = document.getElementById(`g2-${m.id}`).value;
                     if (g1Val === '' || g2Val === '') return alert('Por favor, informe o placar dos dois lados!');
                     finishMatch(m, g1Val, g2Val);
                  }}> FINALIZAR E ENVIAR PARA TV </button>
                </div>
              ))}
              {matches.filter(m => m.status === 'finished').length > 0 && <h3 style={{marginTop:40, color:'var(--accent-primary)', fontSize:'1rem'}}>RESULTADOS RECENTES</h3>}
              <div style={{display:'grid', gap:10, marginTop:15}}>
                {matches.filter(m => m.status === 'finished').slice(0, 10).map(m => (
                  <div key={m.id} className="glass-panel" style={{padding:20, display:'flex', justifyContent:'space-between', borderRadius:12, opacity:0.8}}>
                    <span style={{fontWeight:'900'}}>{m.pair1?.name} <span style={{color:'var(--accent-primary)', margin:'0 10px'}}>{m.pair1_games}</span></span>
                    <span style={{opacity:0.2}}>X</span>
                    <span style={{fontWeight:'900'}}><span style={{color:'var(--accent-primary)', margin:'0 10px'}}>{m.pair2_games}</span> {m.pair2?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ... Restante do código das abas (Setup, Pairs, Matches) continua igual ao Flat Fetch strategy ... */}
        {activeTab === 'setup' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <input style={{width:'100%', marginBottom:15}} value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Novo Torneio" />
             <button onClick={createTournament} className="btn-primary" style={{width:'100%'}}>Salvar Torneio</button>
             {tournaments.length > 0 && <div className="glass-panel" style={{marginTop:30, padding:30}}>
                <select style={{width:'100%', marginBottom:15}} value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Selecione o Torneio</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                {selectedT && <div style={{display:'flex', gap:10}}><input style={{flex:1}} value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Categoria" /><button onClick={createCategory} className="btn-primary">Criar</button></div>}
             </div>}
          </div>
        )}
        {activeTab === 'pairs' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                <select value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select value={selectedC} onChange={e => setSelectedC(e.target.value)}><option value="">Categoria...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
             </div>
             {selectedC && <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}><input placeholder="Atleta 1" value={p1Name} onChange={e => setP1Name(e.target.value)} /><input placeholder="Atleta 2" value={p2Name} onChange={e => setP2Name(e.target.value)} /><button onClick={createPair} className="btn-primary" style={{gridColumn:'1 / span 2'}}>REGISTRAR DUPLA</button></div>}
          </div>
        )}
        {activeTab === 'matches' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                <select value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select value={selectedC} onChange={e => setSelectedC(e.target.value)}><option value="">Categoria...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
             </div>
             {selectedC && <div>
                <div style={{display:'flex', gap:15, marginBottom:20, alignItems:'center'}}>
                   <select style={{flex:1}} value={matchP1} onChange={e => setMatchP1(e.target.value)}><option value="">Dupla Alpha</option>{pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                   <div style={{fontWeight:'900', color:'var(--accent-primary)'}}>X</div>
                   <select style={{flex:1}} value={matchP2} onChange={e => setMatchP2(e.target.value)}><option value="">Dupla Beta</option>{pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
                <button onClick={createMatch} className="btn-primary" style={{width:'100%'}}>GERAR PARTIDA AGORA</button>
             </div>}
          </div>
        )}
      </main>
    </div>
  );
}
