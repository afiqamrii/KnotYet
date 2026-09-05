import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Heart, Sparkles, RefreshCw, Trophy, ArrowRight } from 'lucide-react';
import { GUESS_QUIZ_LIST } from '../data/questions';
import { sounds } from '../utils/audio';

export const CoupleGuessGame: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<'secret' | 'guess' | 'reveal'>('secret');
  const [actualAnswer, setActualAnswer] = useState<string | null>(null);
  const [guessedAnswer, setGuessedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const currentQuiz = GUESS_QUIZ_LIST[currentIndex];
  const isBoyTarget = currentQuiz.targetRole === 'Lelaki';

  const handleSelectActual = (option: string) => {
    setActualAnswer(option);
    sounds.playFlip();
    setStage('guess');
  };

  const handleSelectGuess = (option: string) => {
    setGuessedAnswer(option);
    const isMatch = option === actualAnswer;

    if (isMatch) {
      setScore((prev) => prev + 1);
      sounds.playSuccess();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else {
      sounds.playMismatch();
    }

    setStage('reveal');
  };

  const handleNext = () => {
    if (currentIndex + 1 < GUESS_QUIZ_LIST.length) {
      setCurrentIndex((prev) => prev + 1);
      setStage('secret');
      setActualAnswer(null);
      setGuessedAnswer(null);
    } else {
      setCompleted(true);
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.5 }
      });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setStage('secret');
    setActualAnswer(null);
    setGuessedAnswer(null);
    setScore(0);
    setCompleted(false);
  };

  if (completed) {
    const percentage = Math.round((score / GUESS_QUIZ_LIST.length) * 100);
    return (
      <div className="w-full max-w-sm mx-auto bg-white rounded-3xl p-6 shadow-xl border border-rose-100 text-center space-y-5 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <Trophy className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">Keputusan Ujian Keserasian</span>
          <h2 className="text-3xl font-extrabold text-stone-800 mt-1">{percentage}% Green Flag!</h2>
          <p className="text-xs text-stone-500 mt-1">
            Korang teka betul <span className="font-bold text-rose-600">{score}</span> daripada {GUESS_QUIZ_LIST.length} soalan.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 text-left text-xs leading-relaxed text-stone-700 space-y-2">
          <div className="font-bold text-stone-900 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            Ulasan Jodoh:
          </div>
          {percentage >= 80 ? (
            <p>Fuh! Korang memang sehati sejiwa gila. Cara fikir dan selera makan hampir 100% sekepala. Boleh terus tempah dewan kenduri ni! 💍✨</p>
          ) : percentage >= 50 ? (
            <p>Vibe korang agak seimbang! Banyak benda dah tahu, tapi ada sikit lagi rahsia selera makan yang kena explore sama-sama lepak cafe nanti. ☕</p>
          ) : (
            <p>Nampak gayanya kena kerap lagi dating & sembang santai. Yang salah teka kena belanja makan malam ni sebagai denda rasmi! 🍔😂</p>
          )}
        </div>

        <button
          onClick={handleRestart}
          className="w-full py-3 px-4 rounded-2xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-600 transition shadow-md active:scale-98"
        >
          <RefreshCw className="w-4 h-4" /> Main Semula Pusingan Baru
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-3xl p-6 shadow-xl border border-rose-100 space-y-5 flex flex-col justify-between min-h-[500px]">
      {/* Progress & Header */}
      <div>
        <div className="flex items-center justify-between text-xs text-stone-400 font-semibold mb-2">
          <span>Soalan {currentIndex + 1} / {GUESS_QUIZ_LIST.length}</span>
          <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full font-bold">
            <Heart className="w-3.5 h-3.5 fill-rose-500" /> Skor: {score}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / GUESS_QUIZ_LIST.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Target Question */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          🎯 Ujian Mengenali {currentQuiz.targetRole}
        </div>
        <h3 className="text-lg md:text-xl font-extrabold text-stone-800 leading-snug">
          "{currentQuiz.question}"
        </h3>
        <p className="text-[11px] text-stone-400 italic">
          {currentQuiz.vibeText}
        </p>
      </div>

      {/* STAGE 1: ACTUAL PERSON PICKS (SECRETLY) */}
      {stage === 'secret' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-center">
            <p className="text-xs font-bold text-stone-800 flex items-center justify-center gap-1.5">
              <span>🤫</span> Giliran <span className="text-rose-600 underline">{currentQuiz.targetRole}</span> Pilih Rahsia:
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              (Pasangan sila tutup mata kejap, jangan intai skrin!)
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {currentQuiz.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelectActual(opt)}
                className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-rose-300 hover:bg-rose-50/50 text-stone-700 text-xs font-semibold transition active:scale-98 flex items-center justify-between"
              >
                <span>{opt}</span>
                <span className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center text-[10px] text-stone-400">
                  {String.fromCharCode(65 + i)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 2: PARTNER GUESSES */}
      {stage === 'guess' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
            <p className="text-xs font-bold text-indigo-900 flex items-center justify-center gap-1.5">
              <span>👀</span> Giliran <span className="text-indigo-600 underline">{isBoyTarget ? 'Perempuan' : 'Lelaki'}</span> Teka:
            </p>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              Agak-agak apa jawapan sebenar yang si dia baru pilih tadi?
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {currentQuiz.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelectGuess(opt)}
                className="w-full text-left p-3 rounded-xl border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-stone-700 text-xs font-semibold transition active:scale-98 flex items-center justify-between"
              >
                <span>{opt}</span>
                <span className="w-5 h-5 rounded-full border border-indigo-300 flex items-center justify-center text-[10px] text-indigo-500">
                  {String.fromCharCode(65 + i)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 3: REVEAL RESULT */}
      {stage === 'reveal' && (
        <div className="space-y-4 animate-in zoom-in-95 duration-200">
          {actualAnswer === guessedAnswer ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-center space-y-1">
              <div className="text-2xl">🎉✨</div>
              <h4 className="text-sm font-extrabold text-emerald-800">SEHATI SEJIWA! PADANAN TEPAT!</h4>
              <p className="text-xs text-emerald-700">
                Korang berdua memang sehati! Dua-dua pilih: <strong className="underline font-bold">"{actualAnswer}"</strong>
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1">
              <div className="text-2xl">🙈💔</div>
              <h4 className="text-sm font-extrabold text-rose-800">ALAMAK, TERSASAR!</h4>
              <p className="text-xs text-rose-700">
                {currentQuiz.targetRole} pilih: <strong>"{actualAnswer}"</strong>
                <br />
                Tapi tekaan pasangan: <em>"{guessedAnswer}"</em>
              </p>
              <span className="inline-block mt-1 text-[11px] text-rose-600 bg-white/80 px-2.5 py-0.5 rounded-full border border-rose-200 font-medium">
                Denda: Yang salah belanja jajan! 🍟
              </span>
            </div>
          )}

          <button
            onClick={handleNext}
            className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-98"
          >
            <span>Soalan Seterusnya</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Tip */}
      <div className="text-center text-[10px] text-stone-400 flex items-center justify-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-500" />
        Sesuai dimainkan sambil lepak di cafe atau dalam kereta!
      </div>
    </div>
  );
};
