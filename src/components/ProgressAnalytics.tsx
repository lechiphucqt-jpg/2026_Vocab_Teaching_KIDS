import { useMemo } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  HelpCircle,
  Mic,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import type { BrandSettings, LessonDeck, VocabCard } from '../types/edtech';

interface ProgressAnalyticsProps {
  decks: LessonDeck[];
  cards: VocabCard[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  settings: BrandSettings;
  scoreA: number;
  scoreB: number;
}

export function ProgressAnalytics({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  settings,
  scoreA,
  scoreB,
}: ProgressAnalyticsProps) {
  const currentDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
  const deckCards = cards
    .filter((c) => c.deckId === selectedDeckId)
    .sort((a, b) => a.order - b.order);

  // Compute metrics
  const totalCards = deckCards.length;
  const masteredCards = deckCards.filter((c) => c.bestStars >= 4).length;
  const inProgressCards = deckCards.filter((c) => c.bestStars >= 2 && c.bestStars < 4).length;
  const needReviewCards = deckCards.filter((c) => c.bestStars < 2).length;

  const averageStars = totalCards > 0
    ? (deckCards.reduce((acc, c) => acc + (c.bestStars || 0), 0) / totalCards).toFixed(1)
    : '0';

  // Radar chart points (Listening, Speaking, Reading, Reflex)
  const skillsData = useMemo(() => {
    const speakingAvg = totalCards > 0
      ? (deckCards.reduce((acc, c) => acc + (c.bestStars || 0), 0) / (totalCards * 5)) * 100
      : 50;

    const listeningScore = Math.min(100, Math.round(speakingAvg * 1.05 + 15));
    const readingScore = Math.min(100, Math.round(masteredCards > 0 ? (masteredCards / totalCards) * 100 : 40));
    const reflexScore = Math.min(100, Math.max(30, (scoreA + scoreB) * 5 + 40));

    return [
      { name: 'Listening (Nghe hiểu)', score: listeningScore, angle: -Math.PI / 2 },
      { name: 'Reading (Nhận diện chữ)', score: readingScore, angle: 0 },
      { name: 'Reflex (Phản xạ Game)', score: reflexScore, angle: Math.PI / 2 },
      { name: 'Speaking (Phát âm chuẩn)', score: Math.round(speakingAvg), angle: Math.PI },
    ];
  }, [deckCards, totalCards, masteredCards, scoreA, scoreB]);

  // Radar SVG Math
  const radarSvgPoints = useMemo(() => {
    const center = 140;
    const radius = 100;
    return skillsData
      .map((skill) => {
        const r = (skill.score / 100) * radius;
        const x = center + r * Math.cos(skill.angle);
        const y = center + r * Math.sin(skill.angle);
        return `${x},${y}`;
      })
      .join(' ');
  }, [skillsData]);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phân tích Năng lực & Vườn Hoa Tri Thức</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900">
            Tiến Độ Học Tập & Bảng Thi Đua
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Theo dõi mức độ thành thạo 4 kỹ năng của học sinh theo từng chủ đề bài học, gợi ý từ vựng cần ôn tập ngắt quãng (Spaced Repetition).
          </p>
        </div>

        {/* Deck Picker */}
        <div className="min-w-[240px] bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Chọn chủ đề xem báo cáo:
          </label>
          <select
            value={selectedDeckId}
            onChange={(e) => onSelectDeck(e.target.value)}
            className="w-full bg-white text-slate-800 rounded-lg px-3 py-2 text-sm font-semibold border border-slate-200 outline-none focus:ring-2 focus:ring-sky-500"
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Tổng số từ vựng</span>
            <BookOpen className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalCards} từ</div>
          <div className="text-[11px] text-slate-500 mt-1">{currentDeck?.subtitle}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Từ đã thành thạo</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{masteredCards} từ</div>
          <div className="text-[11px] text-emerald-700 mt-1">Đạt 4-5 sao phát âm</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Cần ôn tập lại</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{needReviewCards} từ</div>
          <div className="text-[11px] text-amber-700 mt-1">Chưa đạt hoặc chưa thử</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Điểm trung bình</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{averageStars} / 5.0</div>
          <div className="text-[11px] text-slate-500 mt-1">Dựa trên Web Speech & AI</div>
        </div>
      </div>

      {/* Main Grid: Radar Chart + Team Competition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Radar Chart (D3 / SVG Math) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Bản Đồ 4 Kỹ Năng Ngôn Ngữ</h3>
              <p className="text-xs text-slate-500">Đánh giá toàn diện Nghe - Nói - Đọc - Phản Xạ</p>
            </div>
            <div className="p-2 rounded-lg bg-sky-50 text-[#0284C7]">
              <Compass className="w-5 h-5" />
            </div>
          </div>

          <div className="relative w-[280px] h-[280px] my-2">
            <svg width="280" height="280" className="overflow-visible">
              {/* Concentric reference circles */}
              {[25, 50, 75, 100].map((percent) => (
                <circle
                  key={percent}
                  cx="140"
                  cy="140"
                  r={(percent / 100) * 100}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeDasharray={percent < 100 ? '3 3' : 'none'}
                />
              ))}

              {/* Cross axes */}
              <line x1="140" y1="40" x2="140" y2="240" stroke="#CBD5E1" strokeWidth="1" />
              <line x1="40" y1="140" x2="240" y2="140" stroke="#CBD5E1" strokeWidth="1" />

              {/* Data Polygon */}
              <polygon
                points={radarSvgPoints}
                fill="rgba(2, 132, 199, 0.25)"
                stroke="#0284C7"
                strokeWidth="2.5"
                className="transition-all duration-700 ease-out"
              />

              {/* Skill Labels */}
              <text x="140" y="24" textAnchor="middle" className="text-[11px] font-bold fill-sky-800">
                👂 Nghe hiểu ({skillsData[0].score}%)
              </text>
              <text x="252" y="144" textAnchor="start" className="text-[11px] font-bold fill-emerald-800">
                📖 Nhận diện ({skillsData[1].score}%)
              </text>
              <text x="140" y="266" textAnchor="middle" className="text-[11px] font-bold fill-purple-800">
                ⚡ Phản xạ Game ({skillsData[2].score}%)
              </text>
              <text x="26" y="144" textAnchor="end" className="text-[11px] font-bold fill-amber-800">
                🗣️ Luyện nói ({skillsData[3].score}%)
              </text>
            </svg>
          </div>

          <div className="w-full grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <strong className="text-slate-800">Điểm mạnh:</strong> Nhận diện mặt chữ và phản xạ trò chơi rất nhanh nhẹn.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <strong className="text-slate-800">Cần phát triển:</strong> Rèn luyện thêm âm đuôi (ending sounds) khi luyện phát âm.
            </div>
          </div>
        </div>

        {/* Classroom Teams Leaderboard */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Thi Đua Lớp Học: {settings.teamAName} vs {settings.teamBName}</h3>
                <p className="text-xs text-slate-500">Tích lũy điểm số qua các trò chơi tương tác</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Trophy className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-6">
              {/* Team A */}
              <div className={`p-5 rounded-2xl border-2 transition-all ${scoreA >= scoreB ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-800 uppercase tracking-wide">{settings.teamAName}</span>
                  {scoreA >= scoreB && <Award className="w-5 h-5 text-amber-500 fill-amber-500" />}
                </div>
                <div className="text-4xl font-extrabold text-sky-700 mt-3">{scoreA}</div>
                <div className="text-[11px] text-slate-500 mt-1">điểm tích lũy</div>
              </div>

              {/* Team B */}
              <div className={`p-5 rounded-2xl border-2 transition-all ${scoreB >= scoreA ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">{settings.teamBName}</span>
                  {scoreB >= scoreA && <Award className="w-5 h-5 text-amber-500 fill-amber-500" />}
                </div>
                <div className="text-4xl font-extrabold text-emerald-700 mt-3">{scoreB}</div>
                <div className="text-[11px] text-slate-500 mt-1">điểm tích lũy</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 flex items-center gap-3">
            <Flame className="w-6 h-6 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-900">
              {scoreA === scoreB ? (
                <span>Trận đấu đang ở thế cân bằng! Hãy mở tab <strong>Trò chơi</strong> để 2 đội phân tài cao thấp!</span>
              ) : scoreA > scoreB ? (
                <span><strong>{settings.teamAName}</strong> đang dẫn trước {scoreA - scoreB} điểm! <strong>{settings.teamBName}</strong> hãy tăng tốc!</span>
              ) : (
                <span><strong>{settings.teamBName}</strong> đang dẫn trước {scoreB - scoreA} điểm! <strong>{settings.teamAName}</strong> cố lên nhé!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vườn Hoa Từ Vựng (Knowledge Bloom Garden) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">🌸 Vườn Hoa Từ Vựng — Cây Tri Thức Của Bé</h3>
            <p className="text-xs text-slate-500">
              Mỗi từ vựng là một bông hoa trong vườn. Luyện tập đều đặn để giúp hoa nở trọn 5 cánh rực rỡ!
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Đã thuộc (4-5★)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Đang tập (2-3★)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Cần gieo hạt (&lt;2★)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {deckCards.map((card) => {
            const stars = card.bestStars || 0;
            const isMastered = stars >= 4;
            const isGood = stars >= 2 && stars < 4;

            return (
              <div
                key={card.id}
                className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-between ${
                  isMastered
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : isGood
                    ? 'border-amber-200 bg-amber-50/30'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {/* Flower / Blossom Visual */}
                <div className="relative my-2">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-transform hover:scale-110 ${
                      isMastered ? 'bg-emerald-100' : isGood ? 'bg-amber-100' : 'bg-slate-200'
                    }`}
                  >
                    {isMastered ? '🌸' : isGood ? '🌱' : '🌰'}
                  </div>
                  {isMastered && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </div>

                <div className="font-bold text-sm text-slate-800">{card.word}</div>
                <div className="text-[11px] text-slate-500 font-mono">{card.phonetic}</div>
                <div className="text-xs text-slate-700 font-medium mt-1 truncate max-w-full">
                  {card.meaning}
                </div>

                {/* Star rating preview */}
                <div className="flex items-center justify-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        s <= stars ? 'text-amber-500 fill-amber-500' : 'text-slate-200 fill-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
