import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch youtube page');
    }

    const html = await res.text();
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    
    if (!match) {
      throw new Error('ytInitialData not found');
    }

    const data = JSON.parse(match[1]);
    let result: { title: string, avatar: string, subs: string, videos: string, banner?: string } = { title: '', avatar: '', subs: '', videos: '', banner: '' };

    const findValues = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.channelMetadataRenderer) {
        if(!result.title) result.title = obj.channelMetadataRenderer.title;
        if(!result.avatar) result.avatar = obj.channelMetadataRenderer.avatar?.thumbnails?.[0]?.url;
      }
      
      if (obj.c4TabbedHeaderRenderer) {
        if(!result.banner && obj.c4TabbedHeaderRenderer.banner?.thumbnails?.length > 0) {
           const thumbs = obj.c4TabbedHeaderRenderer.banner.thumbnails;
           result.banner = thumbs[thumbs.length - 1].url; // Get highest quality
        }
      }

      if (obj.subscriberCountText?.simpleText) {
        result.subs = obj.subscriberCountText.simpleText;
      }
      
      if (obj.pageHeaderViewModel) {
        const metaParts = obj.pageHeaderViewModel.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts;
        if (metaParts) {
          metaParts.forEach((part: any) => {
            const text = part.text?.content || '';
            if (text.includes('subscribers') || text.includes('مشترك')) result.subs = text;
            if (text.includes('videos') || text.includes('فيديو') || text.includes('مقطع')) result.videos = text;
          });
        }
        
        if(!result.title) result.title = obj.pageHeaderViewModel.title?.dynamicTextViewModel?.text?.content;
        if(!result.avatar) result.avatar = obj.pageHeaderViewModel.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url;
        
        if(!result.banner && obj.pageHeaderViewModel.banner?.imageBannerViewModel?.image?.sources) {
           const sources = obj.pageHeaderViewModel.banner.imageBannerViewModel.image.sources;
           result.banner = sources[sources.length - 1].url;
        }
      }

      Object.values(obj).forEach(findValues);
    }

    findValues(data);

    // Clean up urls
    if (result.avatar && result.avatar.startsWith('//')) {
      result.avatar = 'https:' + result.avatar;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('YouTube Scraper Error:', error.message);
    return NextResponse.json({ error: 'Failed to scrape channel data', details: error.message }, { status: 500 });
  }
}
