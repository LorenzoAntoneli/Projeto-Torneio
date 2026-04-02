import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Search, Trophy, Clock, Medal } from 'lucide-react';
import logo from './assets/logo.jpg';

export default function PlayerView() {
  const [matches, setMatches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: catData } = await supabase.from('categories').select('*');
      setCategories(catData || []);

      const { data: mData } = await supabase
        .from('matches')
        .select(`
          *,
          pair1:pairs!matches_pair1_id_fkey(name),
          pair2:pairs!matches_pair2_id_fkey(name),
          category:categories(name)
        `)
        .order('updated_at', { ascending: false });
      
      const formatted = (mData || []).map(m => ({
        ...m,
        pair1_name: m.pair1?.name,
        pair2_name: m.pair2?.name,
        category_name: m.category?.name
      }));
      setMatches(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('player_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const filteredMatches = matches.filter(m => {
    const matchesCat = selectedCategory === 'all' || m.category_id === selectedCategory;
    const matchesSearch = !searchTerm || 
      m.pair1_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.pair2_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const liveMatches = filteredMatches.filter(m => m.status === 'in_progress');
  const otherMatches = filteredMatches.filter(m => m.status !== 'in_progress');

  return (
    <div className="mobile-container">
      <header className="mobile-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={logo} alt="Logo" style={{ height: 40, borderRadius: 8 }} />
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Careca's Club</h1>
      </header>

      <div className="mobile-search-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar jogador ou dupla..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="mobile-categories-scroll">
        <button 
          className={`cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id} 
            className={`cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <main className="mobile-main">
        {loading ? (
          <div className="mobile-status-msg">Carregando partidas...</div>
        ) : filteredMatches.length === 0 ? (
          <div className="mobile-status-msg">Nenhuma partida encontrada.</div>
        ) : (
          <>
            {liveMatches.length > 0 && (
              <section className="mobile-section">
                <h2 className="section-title active-title">
                  <span className="live-dot"></span> Em Andamento
                </h2>
                {liveMatches.map(m => <MatchItem key={m.id} match={m} />)}
              </section>
            )}

            {otherMatches.length > 0 && (
              <section className="mobile-section">
                <h2 className="section-title">
                  {searchTerm ? 'Resultados da Busca' : 'Próximas / Finalizadas'}
                </h2>
                {otherMatches.map(m => <MatchItem key={m.id} match={m} />)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MatchItem({ match }) {
  const isFinished = match.status === 'finished';
  
  return (
    <div className={`mobile-match-item ${isFinished ? 'finished' : ''}`}>
      <div className="item-header">
        <span className="item-cat">{match.category_name}</span>
        {isFinished ? (
          <span className="status-badge finished">Finalizado</span>
        ) : match.status === 'in_progress' ? (
          <span className="status-badge live">Ao Vivo</span>
        ) : (
          <span className="status-badge pending">Aguardando</span>
        )}
      </div>
      
      <div className="item-body">
        <div className={`team-row ${match.winner_id === match.pair1_id ? 'winner' : ''}`}>
          <span className="team-name">{match.pair1_name}</span>
          <div className="team-score">
            <span className="sets">{match.pair1_sets}</span>
            <span className="games">{match.pair1_games}</span>
            <span className="points">{match.pair1_score}</span>
          </div>
        </div>
        
        <div className="vs-divider">VS</div>
        
        <div className={`team-row ${match.winner_id === match.pair2_id ? 'winner' : ''}`}>
          <span className="team-name">{match.pair2_name}</span>
          <div className="team-score">
            <span className="points">{match.pair2_score}</span>
            <span className="games">{match.pair2_games}</span>
            <span className="sets">{match.pair2_sets}</span>
          </div>
        </div>
      </div>
      
      <div className="item-footer">
        <Clock size={12} />
        <span>Atualizado às {new Date(match.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
    </div>
  );
}
