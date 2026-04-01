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

  if (!session) return (
    <div className="admin-login-screen">
      <div className="glass-panel login-card">
        <Trophy size={60} color="var(--accent-primary)" />
        <h2>Careca’s Admin</h2>
        <form onSubmit={login}>
          <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="btn-primary">Acessar Painel</button>
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
          <div className="nav-spacer"></div>
          <a href="/tv" target="_blank" className="nav-link tv-link">
            <Monitor size={20} /> Ver na TV
          </a>
          <div className="nav-link logout-btn" onClick={logout}>
            <LogOut size={20} /> Sair
          </div>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'scoreboard' && (
          <div className="admin-view-container">
            <h2 className="view-title">Partidas Ativas</h2>
            <div className="matches-list">
              {matches.map(m => (
                <div key={m.id} className="glass-panel match-ctrl-card">
                  <div className="card-header">
                    <span className="cat-badge">{m.category_name}</span>
                    <span className={`status-text ${m.status}`}>{m.status.toUpperCase()}</span>
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
                    <button className="btn-primary start-btn" onClick={() => startMatch(m.id)}>Iniciar Partida</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Outras abas (Setup e Import) aqui também com a mesma estrutura limpa */}
      </main>
    </div>
  );
}
