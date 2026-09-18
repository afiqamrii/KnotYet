import { BrandMark } from './ArcadeArt';

export const LoadingScreen = () => (
  <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#fffaf0]" role="status" aria-label="Loading KnotYet">
    <div className="flex flex-col items-center gap-4 text-[#241d35]">
      <div className="w-20 h-20 border-2 border-[#241d35] rounded-3xl bg-[#e8dcff] flex items-center justify-center shadow-[4px_5px_0_#241d35] animate-bounce-soft"><BrandMark /></div>
      <span className="text-xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>A little play. A little closer.</span>
      <span className="text-xs text-[#787080]">Getting the good times ready…</span>
    </div>
  </div>
);
