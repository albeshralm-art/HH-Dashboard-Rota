import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  User, 
  ExternalLink, 
  Plus, 
  Edit2, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  BarChart3,
  Search,
  X,
  Info,
  Filter
} from 'lucide-react';

const ACADEMIC_YEAR_LABEL = 'Academic Year 2026-2027';
const ACADEMIC_YEAR_START = 2026;
const TEAMS_MEETING_URL = 'https://teams.microsoft.com/meet/387117726034966?p=aITRkHssAsroKo6xpQ';
const ENABLE_DASHBOARD_EDITING = false;
const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

function App({ data, updateItem, deleteItem, insertItem, moveItem }) {
  const [editingItem, setEditingItem] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- 1. Data Sanitization & Parsing ---
  
  const sanitizeText = (text) => {
    if (!text || typeof text !== 'string') return text;
    // Aggressively clean up common encoding artifacts (Mojibake) and non-standard symbols
    return text
      .replace(/â/g, '-')
      .replace(/â/g, '-')
      .replace(/â/g, '-')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
      .replace(/[\u00A0\uFFFD]/g, ' ')
      .trim();
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') {
      const googleEpoch = new Date(Date.UTC(1899, 11, 30));
      googleEpoch.setUTCDate(googleEpoch.getUTCDate() + dateStr);
      return new Date(googleEpoch.getUTCFullYear(), googleEpoch.getUTCMonth(), googleEpoch.getUTCDate());
    }

    const textDate = String(dateStr).trim();
    const academicDate = textDate.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})(?:[-\s/](\d{2,4}))?$/);
    if (academicDate) {
      const day = Number(academicDate[1]);
      const month = MONTH_INDEX[academicDate[2].slice(0, 3).toLowerCase()];
      const explicitYear = academicDate[3] ? Number(academicDate[3]) : null;

      if (Number.isFinite(day) && month !== undefined) {
        const year = explicitYear
          ? explicitYear + (explicitYear < 100 ? 2000 : 0)
          : month >= 8 ? ACADEMIC_YEAR_START : ACADEMIC_YEAR_START + 1;
        return new Date(year, month, day);
      }
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Discover Headers dynamically
  const headerRow = data[0]?.row || [];
  const colMap = {
    date: headerRow.findIndex(h => h === 'DATE'),
    desc: headerRow.findIndex(h => h === 'MEETING DESCRIPTION'),
    presenter: headerRow.findIndex(h => h === 'PRESENTER'),
    jcTitle: headerRow.findIndex(h => h === 'JC Title'),
    doi: headerRow.findIndex(h => h === 'DOI'),
    comments: headerRow.findIndex(h => h === 'Comments'),
    statsName: 7, 
    statsTalk: 8,
    statsDataBlitz: 9,
    statsJournalClub: 10,
    statsWm: 11
  };

  // Transform raw data into structured objects
  const meetings = useMemo(() => {
    return data
      .slice(1)
      .filter(item => item.row[colMap.date] || item.row[colMap.desc])
      .map(item => {
        const parsedDate = parseDate(item.row[colMap.date]);
        
        // This formats the date perfectly so the "Edit Session" popup calendar works
        const localDateString = parsedDate 
          ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
          : '';

        return {
          index_: item.index_,
          dateStr: localDateString, 
          date: parsedDate,
          description: sanitizeText(item.row[colMap.desc]) || 'Untitled',
          presenter: sanitizeText(item.row[colMap.presenter]),
          jcTitle: sanitizeText(item.row[colMap.jcTitle]),
          doi: item.row[colMap.doi],
          comments: sanitizeText(item.row[colMap.comments])
        };
      });
  }, [data, colMap]);

  // --- 2. Sorting Logic ---
  // Upcoming sessions first (ascending), Past sessions at bottom (descending) and dimmed.
  const sortedMeetings = useMemo(() => {
    const upcoming = meetings
      .filter(m => !m.date || m.date >= today)
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
      });

    const past = meetings
      .filter(m => m.date && m.date < today)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    let results = [...upcoming, ...past];

    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      results = results.filter(m => 
        m.description.toLowerCase().includes(lowSearch) ||
        (m.presenter && m.presenter.toLowerCase().includes(lowSearch)) ||
        (m.jcTitle && m.jcTitle.toLowerCase().includes(lowSearch))
      );
    }
    return results;
  }, [meetings, today, searchTerm]);

  const nextMeeting = useMemo(() => 
    meetings.filter(m => m.date && m.date >= today).sort((a, b) => a.date - b.date)[0]
  , [meetings, today]);

  const readNumber = (value) => {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Extract statistics from the dynamic side counter in the sheet.
  const stats = useMemo(() => {
    const sections = { hall: [], hw: [] };
    let activeSection = null;

    data.forEach(item => {
      const name = sanitizeText(item.row[colMap.statsName]);
      if (!name) return;

      const upperName = name.toUpperCase();
      if (upperName.includes('HALL LAB')) {
        activeSection = 'hall';
        return;
      }

      if (upperName.includes('HAMILTON') || upperName.includes('KCL')) {
        activeSection = 'hw';
        return;
      }

      if (!activeSection || upperName.includes('COUNTS') || upperName.includes('TALK SLOTS')) return;

      const talkSlots = readNumber(item.row[colMap.statsTalk]);
      const dataBlitz = readNumber(item.row[colMap.statsDataBlitz]);
      const journalClub = readNumber(item.row[colMap.statsJournalClub]);
      const wm = readNumber(item.row[colMap.statsWm]);

      if (talkSlots || dataBlitz || journalClub || wm) {
        sections[activeSection].push({ name, talkSlots, dataBlitz, journalClub, wm });
      }
    });
    return sections;
  }, [data, colMap]);

  const maxTalkSlots = useMemo(() => {
    const allStats = [...stats.hall, ...stats.hw];
    return Math.max(1, ...allStats.map(s => s.talkSlots));
  }, [stats]);

  // --- 3. Style Helpers ---
  const getSessionStyles = (desc) => {
    const d = (desc || '').toUpperCase();
    if (d.includes('HALF TERM')) return {
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      hero: 'bg-amber-600',
      heroLight: 'bg-amber-50',
      heroBadgeText: 'text-amber-600',
      heroBorder: 'border-amber-200',
      ring: 'ring-amber-500/20'
    };
    if (d.includes('XMAS') || d.includes('EASTER') || d.includes('PARTY')) return {
      badge: 'bg-rose-100 text-rose-700 border-rose-200',
      hero: 'bg-rose-600',
      heroLight: 'bg-rose-50',
      heroBadgeText: 'text-rose-600',
      heroBorder: 'border-rose-200',
      ring: 'ring-rose-500/20'
    };
    if (d.includes('JOURNAL CLUB')) return {
      badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      hero: 'bg-indigo-600',
      heroLight: 'bg-indigo-50',
      heroBadgeText: 'text-indigo-600',
      heroBorder: 'border-indigo-200',
      ring: 'ring-indigo-500/20'
    };
    if (d.includes('DATA BLITZ')) return {
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      hero: 'bg-emerald-600',
      heroLight: 'bg-emerald-50',
      heroBadgeText: 'text-emerald-600',
      heroBorder: 'border-emerald-200',
      ring: 'ring-emerald-500/20'
    };
    if (d.includes('WM DATA')) return {
      badge: 'bg-sky-100 text-sky-700 border-sky-200',
      hero: 'bg-sky-600',
      heroLight: 'bg-sky-50',
      heroBadgeText: 'text-sky-600',
      heroBorder: 'border-sky-200',
      ring: 'ring-sky-500/20'
    };
    return {
      badge: 'bg-slate-100 text-slate-600 border-slate-200',
      hero: 'bg-slate-700',
      heroLight: 'bg-slate-50',
      heroBadgeText: 'text-slate-600',
      heroBorder: 'border-slate-200',
      ring: 'ring-slate-500/20'
    };
  };

  const getPresenterLabel = (desc) => {
    const d = (desc || '').toUpperCase();
    if (d.includes('WM DATA')) return 'Expected Attendees';
    if (d.includes('JOURNAL CLUB') || d.includes('DATA BLITZ')) return 'Presenters';
    return 'Lead Speaker';
  };

  const getSessionGuidance = (desc) => {
    const d = (desc || '').toUpperCase();

    if (d.includes('JOURNAL CLUB')) {
      return {
        title: 'Journal Club format',
        text: 'Two presenters for now. We can trial a white-paper style session where everyone reads the paper and may be asked to discuss any figure.'
      };
    }

    if (d.includes('DATA BLITZ')) {
      return {
        title: 'Data Blitz format',
        text: 'Three presenters, about 10 minutes each, with time kept for discussion. Please include a quick background slide, define abbreviations, and explain any MOA before the data.'
      };
    }

    if (d.includes('WM DATA')) {
      return {
        title: 'WM meeting',
        text: 'Catherine, Nicola, Janice, Craig, Sunny, Harry, and Albeshr are expected. Everyone else is welcome to join.'
      };
    }

    if (d.includes('INTRO')) {
      return {
        title: 'Intro session',
        text: 'Please share who you are, what you will be working on this year, and one fun fact or memorable thing from the last year.'
      };
    }

    return null;
  };

  const handleSave = (formData) => {
    const row = [];
    row[colMap.date] = formData.date;
    row[colMap.desc] = formData.desc;
    row[colMap.presenter] = formData.presenter;
    row[colMap.jcTitle] = formData.jcTitle;
    row[colMap.doi] = formData.doi;
    row[colMap.comments] = formData.comments;

    if (editingItem) {
      updateItem(editingItem.index_, row);
      setEditingItem(null);
    } else {
      insertItem(undefined, row);
      setIsAdding(false);
    }
  };

  const nextStyles = nextMeeting ? getSessionStyles(nextMeeting.description) : null;
  const nextGuidance = nextMeeting ? getSessionGuidance(nextMeeting.description) : null;

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Calendar size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Lab Rota & Journal Club</h1>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{ACADEMIC_YEAR_LABEL}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search sessions..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-100 border-transparent border-2 focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-500/5 rounded-2xl text-sm w-56 xl:w-72 transition-all outline-none font-medium"
              />
            </div>
            <a
              href={TEAMS_MEETING_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#6264A7] hover:bg-[#5557a5] text-white px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-200/60 active:scale-95 whitespace-nowrap"
            >
              Join Teams
              <ExternalLink size={16} strokeWidth={3} />
            </a>
            {ENABLE_DASHBOARD_EDITING && (
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95"
              >
                <Plus size={18} strokeWidth={3} />
                Add Session
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
          
          {/* Hero Card for Next Meeting (Dynamic Color Code Applied) */}
          {nextMeeting && !searchTerm && (
            <section>
              <div className="flex items-center gap-2 mb-4 px-1">
                <span className={`w-1.5 h-1.5 rounded-full ${nextStyles.hero} animate-pulse`}></span>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Up Next</h2>
              </div>
              <div className={`bg-white rounded-[2.5rem] p-8 shadow-sm border ${nextStyles.heroBorder} relative overflow-hidden flex flex-col md:flex-row gap-8`}>
                {/* Decorative background element */}
                <div className={`absolute top-0 right-0 w-64 h-64 ${nextStyles.heroLight} rounded-full -translate-y-1/2 translate-x-1/3 opacity-50 -z-0`} />
                
                <div className={`flex flex-col items-center justify-center w-32 h-32 ${nextStyles.hero} rounded-[2rem] text-white shrink-0 shadow-2xl relative z-10`}>
                  <span className="text-3xl font-black">{nextMeeting.date?.getDate()}</span>
                  <span className="text-xs font-bold uppercase tracking-tighter opacity-80">
                    {nextMeeting.date?.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </div>

                <div className="flex-1 relative z-10">
                  <div className={`flex items-center gap-3 mb-2 ${nextStyles.heroBadgeText} font-bold text-sm`}>
                    <Calendar size={16} />
                    {nextMeeting.date?.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric' })}
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mb-6">{nextMeeting.description}</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {nextMeeting.presenter && (
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{getPresenterLabel(nextMeeting.description)}</span>
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <User size={14} className={nextStyles.heroBadgeText} />
                          {nextMeeting.presenter}
                        </div>
                      </div>
                    )}
                    {nextMeeting.jcTitle && (
                      <div className={`${nextStyles.heroLight} border border-transparent p-4 rounded-2xl`}>
                        <span className={`text-[10px] font-black ${nextStyles.heroBadgeText} uppercase tracking-widest block mb-2`}>Topic / Paper</span>
                        <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                          "{nextMeeting.jcTitle}"
                        </p>
                        {nextMeeting.doi && (
                          <a href={nextMeeting.doi} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 mt-2 text-xs ${nextStyles.heroBadgeText} font-black hover:underline group`}>
                            Reference <ExternalLink size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </a>
                        )}
                      </div>
                    )}
                    {nextGuidance && (
                      <div className={`${nextStyles.heroLight} border ${nextStyles.heroBorder} p-4 rounded-2xl lg:col-span-2`}>
                        <span className={`text-[10px] font-black ${nextStyles.heroBadgeText} uppercase tracking-widest block mb-2`}>{nextGuidance.title}</span>
                        <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                          {nextGuidance.text}
                        </p>
                      </div>
                    )}
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl lg:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest block mb-2">Teams link</span>
                        <p className="text-sm font-semibold text-white/80 leading-relaxed">
                          Same meeting link every Friday until 30 July 2027.
                        </p>
                      </div>
                      <a
                        href={TEAMS_MEETING_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-indigo-50 px-4 py-2.5 rounded-2xl text-sm font-black transition-all active:scale-95 whitespace-nowrap"
                      >
                        Join Teams
                        <ExternalLink size={15} strokeWidth={3} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Full Schedule Feed */}
          <section>
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Full Rota Schedule</h2>
              </div>
              <span className="text-xs font-bold text-slate-400">{sortedMeetings.length} sessions listed</span>
            </div>

            <div className="space-y-3">
              {sortedMeetings.map((m) => {
                const styles = getSessionStyles(m.description);
                const isPast = m.date && m.date < today;
                const isNext = nextMeeting && m.index_ === nextMeeting.index_;

                return (
                  <div 
                    key={m.index_}
                    className={`group flex items-center gap-6 p-5 rounded-3xl transition-all duration-300 border
                      ${isPast ? 'bg-slate-50/50 border-slate-100 opacity-40 grayscale-[0.3]' : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-xl hover:shadow-slate-500/5 hover:-translate-y-0.5'}
                      ${isNext ? `ring-2 ${styles.ring}` : ''}
                    `}
                  >
                    {/* Date Block */}
                    <div className="w-36 shrink-0 flex flex-col">
                      <span className={`text-sm font-black ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>
                        {m.date?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) || 'TBD'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 flex items-center gap-1">
                        {isPast ? (
                          <><CheckCircle2 size={10} className="text-emerald-700" /> Done</>
                        ) : (
                          <><Clock size={10} /> {m.date?.toLocaleDateString('en-GB', { weekday: 'short' }) || 'TBD'}</>
                        )}
                      </span>
                    </div>

                    {/* Content Block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${styles.badge}`}>
                          {m.description}
                        </span>
                        {m.presenter && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 truncate">
                            <User size={12} className="text-slate-400" />
                            {m.presenter}
                          </div>
                        )}
                      </div>
                      {m.jcTitle && (
                        <p className={`text-xs font-medium italic truncate max-w-2xl ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                          {m.jcTitle}
                        </p>
                      )}
                    </div>

                    {/* Actions Block */}
                    {ENABLE_DASHBOARD_EDITING && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setEditingItem(m)}
                          className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => deleteItem(m.index_)}
                          className="p-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Right Sidebar (Stats) */}
      <aside className="w-80 bg-white border-l border-slate-200 p-8 flex flex-col gap-10 overflow-y-auto shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-slate-900" />
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Presenter Stats</h2>
        </div>

        <div className="space-y-10">
          {/* Hall Lab Section - Dark Green */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hall Lab</span>
              <span className="text-[10px] font-bold text-emerald-900 uppercase">Talk Slots</span>
            </div>
            <div className="space-y-5">
              {stats.hall.map((s, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="font-bold text-slate-700 group-hover:text-emerald-900 transition-colors">{s.name}</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{s.talkSlots}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-900 rounded-full transition-all duration-700 shadow-sm shadow-emerald-900/10" 
                      style={{ width: `${(s.talkSlots / maxTalkSlots) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-black uppercase tracking-tight text-slate-500">
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">DB {s.dataBlitz}</span>
                    <span className="rounded-lg bg-indigo-50 px-2 py-1 text-indigo-700">JC {s.journalClub}</span>
                    {s.wm > 0 && <span className="rounded-lg bg-sky-50 px-2 py-1 text-sky-700">WM {s.wm}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hamilton-Whitaker Section - Muted Red */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hamilton-Whitaker</span>
              <span className="text-[10px] font-bold text-rose-400 uppercase">Talk Slots</span>
            </div>
            <div className="space-y-5">
              {stats.hw.map((s, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="font-bold text-slate-700 group-hover:text-rose-900 transition-colors">{s.name}</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{s.talkSlots}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-400 rounded-full transition-all duration-700 shadow-sm shadow-rose-400/10" 
                      style={{ width: `${(s.talkSlots / maxTalkSlots) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-black uppercase tracking-tight text-slate-500">
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">DB {s.dataBlitz}</span>
                    <span className="rounded-lg bg-indigo-50 px-2 py-1 text-indigo-700">JC {s.journalClub}</span>
                    {s.wm > 0 && <span className="rounded-lg bg-sky-50 px-2 py-1 text-sky-700">WM {s.wm}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-3xl">
          <div className="flex items-center gap-2 mb-3 text-indigo-900">
            <Info size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Journal Club Format</span>
          </div>
          <p className="text-[11px] text-indigo-900/70 leading-relaxed font-medium">
            Two presenters are listed for now. The group may test a white-paper style session where everyone reads the paper and can be invited to discuss any figure.
          </p>
        </div>

        <div className="mt-auto p-5 bg-slate-50 border border-slate-100 rounded-3xl">
          <div className="flex items-center gap-2 mb-3 text-slate-900">
            <Info size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sorting Note</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Meetings that have already passed are moved to the bottom and dimmed. Up Next section automatically updates to match the current session's lab color code.
          </p>
        </div>
      </aside>

      {/* Entry Editor Modal */}
      {ENABLE_DASHBOARD_EDITING && (isAdding || editingItem) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{editingItem ? 'Edit Session' : 'New Session'}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Rota Management</p>
              </div>
              <button 
                onClick={() => { setIsAdding(false); setEditingItem(null); }}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              handleSave({
                date: f.get('date'),
                desc: f.get('desc'),
                presenter: f.get('presenter'),
                jcTitle: f.get('jcTitle'),
                doi: f.get('doi'),
                comments: f.get('comments'),
              });
            }} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Date</label>
                  <input name="date" type="date" defaultValue={editingItem?.dateStr} required className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-500/5 outline-none transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Session Type</label>
                  <input name="desc" placeholder="e.g. Journal Club" defaultValue={editingItem?.description} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-500/5 outline-none transition-all font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Presenter(s)</label>
                <input name="presenter" placeholder="Name(s) of speakers" defaultValue={editingItem?.presenter} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-500/5 outline-none transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">JC Title / Topic</label>
                <textarea name="jcTitle" placeholder="What is being presented?" defaultValue={editingItem?.jcTitle} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm h-28 resize-none focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-500/5 outline-none transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">DOI / Resource Link</label>
                <input name="doi" placeholder="https://..." defaultValue={editingItem?.doi} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-500/5 outline-none transition-all font-bold" />
              </div>
              <div className="flex justify-end gap-4 pt-6">
                <button 
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingItem(null); }}
                  className="px-8 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-10 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
/* canvas_id:1985870859 */
export default App;
