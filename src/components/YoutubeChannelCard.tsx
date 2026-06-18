'use client';

import { useState, useEffect } from 'react';
import { Youtube, Users, Video as VideoIcon, Loader2 } from 'lucide-react';

interface ChannelData {
  title: string;
  avatar: string;
  subs: string;
  videos: string;
}

interface Props {
  url: string;
}

export function YoutubeChannelCard({ url }: Props) {
  const [data, setData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    
    const fetchChannelData = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/youtube?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        
        if (json.title || json.avatar || json.subs) {
          setData(json);
        } else {
          throw new Error('Invalid data');
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [url]);

  if (!url) return null;

  return (
    <div className="card-base p-6 border-red-500/20 bg-gradient-to-l from-red-500/10 to-transparent relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] -z-10 rounded-full" />
      
      <div className="flex items-center gap-5 z-10 w-full text-right">
        {loading ? (
          <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center border border-white/5 animate-pulse shrink-0">
             <Loader2 size={24} className="text-red-500 animate-spin opacity-50" />
          </div>
        ) : data?.avatar ? (
          <img src={data.avatar} alt="Channel Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)] shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] shrink-0">
             <Youtube size={32} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-cairo font-black text-xl text-white truncate" title={data?.title || 'قناة الأستاذ على يوتيوب'}>
            {loading ? <span className="block w-40 h-6 bg-white/10 rounded animate-pulse" /> : (data?.title || 'قناة الأستاذ')}
          </h2>
          
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-300">
             {loading ? (
               <div className="flex gap-2">
                 <span className="w-20 h-4 bg-white/5 rounded animate-pulse" />
                 <span className="w-20 h-4 bg-white/5 rounded animate-pulse" />
               </div>
             ) : error ? (
               <p className="text-xs text-red-400">القناة الرسمية على يوتيوب</p>
             ) : (
               <>
                 {data?.subs && (
                   <span className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-md border border-white/5 shadow-inner">
                     <Users size={14} className="text-red-400" /> <span className="font-bold">{data.subs}</span>
                   </span>
                 )}
                 {data?.videos && (
                   <span className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-md border border-white/5 shadow-inner">
                     <VideoIcon size={14} className="text-blue-400" /> <span className="font-bold">{data.videos}</span>
                   </span>
                 )}
               </>
             )}
          </div>
        </div>
      </div>
      
      <a href={url} target="_blank" rel="noreferrer" className="btn-primary bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(239,68,68,0.3)] border-0 flex items-center gap-2 whitespace-nowrap z-10 w-full md:w-auto justify-center px-8 py-3 text-sm font-black transition-transform hover:scale-105 active:scale-95">
        <Youtube size={20} /> اشترك بالقناة
      </a>
    </div>
  );
}
