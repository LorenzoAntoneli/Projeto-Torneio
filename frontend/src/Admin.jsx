import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Papa from 'papaparse';
import { Trophy, Swords, LayoutList, Users, LogOut, FileUp, Monitor, PlayCircle, Settings, PlusCircle } from 'lucide-react';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('scoreboard');
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  const [newTName, setNewTName] = useState('');
  const [newTMax, setNewTMax] = useState(0);
  const [newCName, setNewCName] = useState('');
  const [newPairName, setNewPairName] = useState('');
  const [matchP1, setMatchP1] = useState('');
  const [matchP2, setMatchP2] = useState('');

  const loadData = async () => {
    try {
      const { data: tData } = await supabase.from('tournaments').select('*');
      setTournaments(tData || []);
      const { data: mData } = await supabase.from('matches').select('*, pair1:pairs!matches_pair1_id_fkey(name), pair2:pairs!matches_pair2_id_fkey(name), category:categories(name)').order('updated_at', { ascending: false });
      const formatted = (mData || []).map(m => ({ ...m, pair1_name: m.pair1?.name, pair2_name: m.pair2?.name, category_name: m.category?.name }));
      setMatches(formatted);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { if (session) loadData(); }, [session]);
  
  useEffect(() => {
    if (selectedT) supabase.from('categories').select('*').eq('tournament_id', selectedT).then(({ data }) => setCategories(data || []));
    else setCategories([]); setSelectedC('');
  }, [selectedT]);
  
  useEffect(() => {
    if (selectedC) supabase.from('pairs').select('*').eq('category_id', selectedC).then(({ data }) => setPairs(data || []));
    else setPairs([]);
  }, [selectedC]);

  const login = (e) => {
    e.preventDefault();
    if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); }
    else alert('Senha inválida');
  };

  const logout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const createTournament = async () => {
    if (!newTName) return;
    await supabase.from('tournaments').insert([{ name: newTName, max_pairs: newTMax }]);
    setNewTName(''); setNewTMax(0); loadData(); setActiveTab('setup');
  };

  const createCategory = async () => {
    if (!selectedT || !newCName) return;
    await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]);
    setNewCName(''); const { data } = await supabase.from('categories').select('*').eq('tournament_id', selectedT);
    setCategories(data || []);
  };

  const createPair = async () => {
    if (!selectedC || !newPairName) return;
    await supabase.from('pairs').insert([{ category_id: selectedC, name: newPairName }]);
    setNewPairName(''); const { data } = await supabase.from('pairs').select('*').eq('category_id', selectedC);
    setPairs(data || []);
  };

  const createMatch = async () => {
    if (!selectedC || !matchP1 || !matchP2 || matchP1 === matchP2) return alert('Selecione duplas diferentes');
    await supabase.from('matches').insert([{ category_id: selectedC, pair1_id: matchP1, pair2_id: matchP2 }]);
    setMatchP1(''); setMatchP2(''); loadData(); setActiveTab('scoreboard');
  };

  const startMatch = async (id) => {
    await supabase.from('matches').update({ status: 'in_progress', updated_at: new Date() }).eq('id', id);
    loadData();
  };

  const handleScore = async (match, teamIdx, action) => {
    let m = { ...match };
    const getNextPt = (pt) => pt === '0' ? '15' : pt === '15' ? '30' : pt === '30' ? '40' : 'A';
    const getPrevPt = (pt) => pt === 'A' ? '40' : pt === '40' ? '30' : pt === '30' ? '15' : '0';

    if (action === '+pt') {
      if (teamIdx === 1) {
          if (m.pair1_score === '40') { m.pair1_score = '0'; m.pair2_score = '0'; m.pair1_games += 1; if (m.pair1_games >= 5) { m.pair1_sets += 1; m.pair1_games = 0; m.pair2_games = 0; } }
          else m.pair1_score = getNextPt(m.pair1_score);
      } else {
          if (m.pair2_score === '40') { m.pair1_score = '0'; m.pair2_score = '0'; m.pair2_games += 1; if (m.pair2_games >= 5) { m.pair2_sets += 1; m.pair1_games = 0; m.pair2_games = 0; } }
          else m.pair2_score = getNextPt(m.pair2_score);
      }
    } else {
      if (teamIdx === 1) m.pair1_score = getPrevPt(m.pair1_score);
      else m.pair2_score = getPrevPt(m.pair2_score);
    }
    
    if (m.pair1_sets >= 1 || m.pair2_sets >= 1) { m.status = 'finished'; m.winner_id = m.pair1_sets >= 1 ? m.pair1_id : m.pair2_id; }
    await supabase.from('matches').update({ pair1_score: m.pair1_score, pair2_score: m.pair2_score, pair1_games: m.pair1_games, pair2_games: m.pair2_games, pair1_sets: m.pair1_sets, pair2_sets: m.pair2_sets, status: m.status, winner_id: m.winner_id, updated_at: new Date() }).eq('id', m.id);
    loadData();
  };

  const handleImport = (e) => {
    e.preventDefault(); if (!importFile) return; setIsImporting(true);
    Papa.parse(importFile, { header: true, skipEmptyLines: true, complete: async (results) => {
        try {
          const tCache = {}; const cCache = {};
          for (const row of results.data) {
            const tN = row.Tournament || row.torneio || 'Torneio';
            const cN = row.Category || row.categoria || 'Geral';
            const pN = row.PairName || row.dupla || 'Anonimo';
            if (!tCache[tN]) { let { data: t } = await supabase.from('tournaments').select('id').eq('name', tN).single(); if (!t) { const { data: nT } = await supabase.from('tournaments').insert([{ name: tN }]).select('id').single(); t = nT; } tCache[tN] = t.id; }
            const cKey = `${tCache[tN]}_${cN}`; if (!cCache[cKey]) { let { data: c } = await supabase.from('categories').select('id').eq('name', cN).eq('tournament_id', tCache[tN]).single(); if (!c) { const { data: nC } = await supabase.from('categories').insert([{ name: cN, tournament_id: tCache[tN] }]).select('id').single(); c = nC; } cCache[cKey] = c.id; }
            await supabase.from('pairs').insert([{ name: pN, category_id: cCache[cKey] }]);
          }
          alert('Importado!'); loadData(); setActiveTab('scoreboard');
        } catch (err) { alert('Erro: ' + err.message); } finally { setIsImporting(false); setImportFile(null); }
      }
    });
  };

  if (!session) return (
    <div style={{height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <div className="glass-panel" style={{padding: '50px', borderRadius: '32px', width: '400px', textAlign: 'center', border: '2px solid var(--accent-primary)'}}>
        <Trophy size={60} color="var(--accent-primary)" style={{marginBottom: 20}} />
        <h2 style={{fontSize: '1.6rem', marginBottom: 30, textTransform: 'uppercase', letterSpacing: 2}}>Careca’s Admin</h2>
        <form onSubmit={login}>
          <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} style={{width: '100%', marginBottom: 20, textAlign: 'center', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px'}} />
          <button type="submit" className="btn-primary" style={{width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer'}}>Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar glass-panel">
        <div className="sidebar-brand">CARECA’S CLUB</div>
        <nav className="admin-nav">
          <div className={`nav-link ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}>
            <Swords size={20} /> Placar Ativo
          </div>
          <div className={`nav-link ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}>
            <PlusCircle size={20} /> 1. Configurar
          </div>
          <div className={`nav-link ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
            <FileUp size={20} /> 2. Importar
          </div>
          <div style={{flex: 1}}></div>
          <a href="/tv" target="_blank" className="nav-link tv-link" style={{textDecoration: 'none'}}>
            <Monitor size={20} /> Ver na TV
          </a>
          <div className="nav-link logout-btn" onClick={logout} style={{color: 'var(--accent-danger)'}}>
            <LogOut size={20} /> Sair
          </div>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'scoreboard' && (
          <div className="admin-view-container">
            <h2 className="view-title">Partidas Ativas</h2>
            <div className="matches-list">
              {matches.length === 0 && <p style={{color: '#666'}}>Nenhuma partida cadastrada.</p>}
              {matches.map(m => (
                <div key={m.id} className="glass-panel match-ctrl-card">
                  <div className="card-header">
                    <span className="cat-badge">{m.category_name}</span>
                    <span style={{color: m.status === 'in_progress' ? 'var(--accent-primary)' : '#666'}}>{m.status.toUpperCase()}</span>
                  </div>
                  
                  <div className="match-teams-grid">
                    <div className="team-control">
                      <h3>{m.pair1_name}</h3>
                      <div className="score-summary">
                        S:<b>{m.pair1_sets}</b> | G:<b>{m.pair1_games}</b> | P:<b>{m.pair1_score}</b>
                      </div>
                      {m.status === 'in_progress' && (
                        <div className="score-btns">
                          <button onClick={() => handleScore(m, 1, '-pt')} className="btn-sub">-</button>
                          <button onClick={() => handleScore(m, 1, '+pt')} className="btn-add">+</button>
                        </div>
                      )}
                    </div>
                    
                    <div className="vs-label">VS</div>
                    
                    <div className="team-control">
                      <h3>{m.pair2_name}</h3>
                      <div className="score-summary">
                         P:<b>{m.pair2_score}</b> | G:<b>{m.pair2_games}</b> | S:<b>{m.pair2_sets}</b>
                      </div>
                      {m.status === 'in_progress' && (
                        <div className="score-btns">
                          <button onClick={() => handleScore(m, 2, '-pt')} className="btn-sub">-</button>
                          <button onClick={() => handleScore(m, 2, '+pt')} className="btn-add">+</button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {m.status === 'pending' && (
                    <button className="btn-primary" style={{width: '100%', marginTop: 20}} onClick={() => startMatch(m.id)}>Iniciar Partida</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="admin-view-container" style={{maxWidth: '700px'}}>
            <h2 className="view-title">1. Configurar Torneio</h2>
            
            <div className="glass-panel" style={{padding: 30, borderRadius: 20, marginBottom: 30}}>
              <h3>Criar Novo Torneio</h3>
              <input style={{width: '100%', margin: '15px 0'}} value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Nome do Torneio" className="admin-input" />
              <button onClick={createTournament} className="btn-primary" style={{width: '100%'}}>Criar Torneio</button>
            </div>

            {tournaments.length > 0 && (
              <div className="glass-panel" style={{padding: 30, borderRadius: 20}}>
                <h3>Adicionar Categoria e Duplas</h3>
                <select style={{width: '100%', margin: '15px 0'}} value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                   <option value="">Selecione o Torneio</option>
                   {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                {selectedT && (
                  <div style={{marginTop: 20}}>
                    <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
                      <input style={{flex: 1}} placeholder="Nome da Categoria" value={newCName} onChange={e => setNewCName(e.target.value)} />
                      <button onClick={createCategory} className="btn-primary">Adicionar</button>
                    </div>

                    <hr style={{borderColor: 'var(--glass-border)', margin: '20px 0'}} />

                    <div style={{display: 'flex', gap: 10}}>
                       <input style={{flex: 1}} placeholder="Nova Dupla" value={newPairName} onChange={e => setNewPairName(e.target.value)} />
                       <select style={{flex: 1}} value={selectedC} onChange={e => setSelectedC(e.target.value)}>
                          <option value="">Categoria...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                       <button onClick={createPair} className="btn-primary">Registrar</button>
                    </div>

                    <hr style={{borderColor: 'var(--glass-border)', margin: '20px 0'}} />
                    
                    <div style={{background: 'rgba(212, 175, 55, 0.05)', padding: 20, borderRadius: 12}}>
                      <h4>Agendar Partida</h4>
                      <div style={{display: 'flex', gap: 10, marginTop: 10}}>
                         <select style={{flex: 1}} value={matchP1} onChange={e => setMatchP1(e.target.value)}>
                            <option value="">Dupla 1</option>
                            {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                         <select style={{flex: 1}} value={matchP2} onChange={e => setMatchP2(e.target.value)}>
                            <option value="">Dupla 2</option>
                            {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                         <button onClick={createMatch} className="btn-primary">Criar Jogo</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="admin-view-container" style={{maxWidth: '600px'}}>
             <h2 className="view-title">2. Importar LetzPlay</h2>
             <div className="glass-panel" style={{padding: 40, borderRadius: 32, textAlign: 'center'}}>
                <FileUp size={48} color="var(--accent-primary)" style={{marginBottom: 20}} />
                <p style={{color: 'var(--text-secondary)', marginBottom: 30}}>Selecione o arquivo CSV do Careca’s Beach Club</p>
                <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files[0])} style={{marginBottom: 20, width: '100%'}} />
                <button onClick={handleImport} className="btn-primary" style={{width: '100%', height: 50}} disabled={!importFile || isImporting}>
                  {isImporting ? 'Processando...' : 'Iniciar Importação'}
                </button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
