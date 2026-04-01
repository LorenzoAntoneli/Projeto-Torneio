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
          if (m.pair1_score === '40') { m.pair1_score = '0'; m.pair2_score = '0'; m.pair1_games += 1; if (m.pair1_games >= 6) { m.pair1_sets += 1; m.pair1_games = 0; m.pair2_games = 0; } }
          else m.pair1_score = getNextPt(m.pair1_score);
      } else {
          if (m.pair2_score === '40') { m.pair1_score = '0'; m.pair2_score = '0'; m.pair2_games += 1; if (m.pair2_games >= 6) { m.pair2_sets += 1; m.pair1_games = 0; m.pair2_games = 0; } }
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
      <div className="glass-panel" style={{padding: '50px', borderRadius: '32px', width: '400px', textAlign: 'center'}}>
        <Trophy size={60} color="var(--accent-warning)" style={{marginBottom: 20}} />
        <h2 style={{fontSize: '1.8rem', marginBottom: 30}}>Acesso Restrito</h2>
        <form onSubmit={login}>
          <input type="password" placeholder="Chave de Acesso" value={password} onChange={e => setPassword(e.target.value)} style={{width: '100%', marginBottom: 20, textAlign: 'center'}} />
          <button type="submit" className="btn-primary" style={{width: '100%'}}>Entrar no Painel</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar glass-panel">
        <h1><Settings size={28} /> Admin</h1>
        <nav>
          <div className={`nav-link ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20} /> Placar Ativo</div>
          <div className={`nav-link ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><PlusCircle size={20} /> 1. Configuração</div>
          <div className={`nav-link ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}><FileUp size={20} /> 2. Importar</div>
          <div style={{flex: 1}}></div>
          <a href="/tv" target="_blank" className="nav-link" style={{color: 'var(--accent-primary)'}}><Monitor size={20} /> Abrir TV</a>
          <div className="nav-link" onClick={logout} style={{color: 'var(--text-danger)'}}><LogOut size={20} /> Sair</div>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'scoreboard' && (
          <div style={{maxWidth: '900px', margin: '0 auto'}}>
            <h2 style={{marginBottom: 30}}>Partidas em Andamento</h2>
            {matches.map(m => (
              <div key={m.id} className="glass-panel admin-card" style={{marginBottom: 20}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
                  <span className="tv-match-category">{m.category_name}</span>
                  <span style={{color: m.status === 'in_progress' ? 'var(--accent-primary)' : 'var(--text-secondary)'}}>{m.status}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20}}>
                   <div style={{flex: 1, textAlign: 'center'}}>
                      <h3 style={{fontSize: '1.4rem'}}>{m.pair1_name}</h3>
                      <div style={{fontSize: '1.2rem', color: 'var(--accent-primary)', margin: '10px 0'}}>S:{m.pair1_sets} | G:{m.pair1_games} | P:{m.pair1_score}</div>
                      {m.status === 'in_progress' && <div style={{display: 'flex', gap: 10, justifyContent: 'center'}}>
                        <button onClick={() => handleScore(m, 1, '-pt')} style={{padding: '10px 20px', borderRadius: 8, background: 'var(--accent-danger)', border: 'none', color: '#fff', fontWeight: 'bold'}}>-</button>
                        <button onClick={() => handleScore(m, 1, '+pt')} style={{padding: '10px 20px', borderRadius: 8, background: 'var(--accent-success)', border: 'none', color: '#fff', fontWeight: 'bold'}}>+</button>
                      </div>}
                   </div>
                   <div style={{fontWeight: 900, color: 'var(--text-secondary)'}}>VS</div>
                   <div style={{flex: 1, textAlign: 'center'}}>
                      <h3 style={{fontSize: '1.4rem'}}>{m.pair2_name}</h3>
                      <div style={{fontSize: '1.2rem', color: 'var(--accent-primary)', margin: '10px 0'}}>S:{m.pair2_sets} | G:{m.pair2_games} | P:{m.pair2_score}</div>
                      {m.status === 'in_progress' && <div style={{display: 'flex', gap: 10, justifyContent: 'center'}}>
                        <button onClick={() => handleScore(m, 2, '-pt')} style={{padding: '10px 20px', borderRadius: 8, background: 'var(--accent-danger)', border: 'none', color: '#fff', fontWeight: 'bold'}}>-</button>
                        <button onClick={() => handleScore(m, 2, '+pt')} style={{padding: '10px 20px', borderRadius: 8, background: 'var(--accent-success)', border: 'none', color: '#fff', fontWeight: 'bold'}}>+</button>
                      </div>}
                   </div>
                </div>
                {m.status === 'pending' && <button className="btn-primary" style={{width: '100%', marginTop: 20}} onClick={() => startMatch(m.id)}>Iniciar Partida</button>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'setup' && (
          <div style={{maxWidth: '600px', margin: '0 auto'}}>
             <div className="glass-panel" style={{padding: 30, borderRadius: 20, marginBottom: 20}}>
                <h3>Criar Novo Torneio</h3>
                <input style={{width: '100%', margin: '15px 0'}} value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Nome do Torneio" />
                <button onClick={createTournament} className="btn-primary" style={{width: '100%'}}>Criar Torneio</button>
             </div>
             {tournaments.length > 0 && <div className="glass-panel" style={{padding: 30, borderRadius: 20}}>
                <h3>Configurar Categorias / Partidas</h3>
                <select style={{width: '100%', margin: '15px 0'}} value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                   <option value="">Selecione o Torneio</option>
                   {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedT && <div style={{marginTop: 20}}>
                    <input style={{width: '100%', marginBottom: 10}} placeholder="Nova Categoria" value={newCName} onChange={e => setNewCName(e.target.value)} />
                    <button onClick={createCategory} className="btn-primary" style={{width: '100%'}}>Adicionar Categoria</button>
                    <hr style={{margin: '20px 0', borderColor: 'var(--glass-border)'}} />
                    <div style={{display: 'flex', gap: 10}}>
                       <input style={{flex: 1}} placeholder="Nova Dupla" value={newPairName} onChange={e => setNewPairName(e.target.value)} />
                       <select style={{flex: 1}} value={selectedC} onChange={e => setSelectedC(e.target.value)}>
                          <option value="">Categoria...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <button onClick={createPair} className="btn-primary" style={{width: '100%', marginTop: 10}}>Adicionar Dupla</button>
                </div>}
             </div>}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="glass-panel" style={{maxWidth: '600px', margin: '0 auto', padding: 40, borderRadius: 32, textAlign: 'center'}}>
             <FileUp size={48} color="var(--accent-primary)" style={{marginBottom: 20}} />
             <h2>Importar Dados</h2>
             <p style={{color: 'var(--text-secondary)', marginBottom: 30}}>Arraste o seu CSV do LetzPlay aqui</p>
             <input type="file" onChange={e => setImportFile(e.target.files[0])} style={{marginBottom: 20, width: '100%'}} />
             <button onClick={handleImport} className="btn-primary" style={{width: '100%'}} disabled={!importFile}>{isImporting ? 'Importando...' : 'Processar Arquivo'}</button>
          </div>
        )}
      </main>
    </div>
  );
}
